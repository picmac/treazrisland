import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { monitorEventLoopDelay } from "node:perf_hooks";
import ipaddr from "ipaddr.js";
import { env } from "../config/env.js";

type LabelSet = Record<string, string>;

function isIPv6Address(
  address: ipaddr.IPv4 | ipaddr.IPv6,
): address is ipaddr.IPv6 {
  return address.kind() === "ipv6";
}

export type MetricsCounter = {
  inc: (labels?: LabelSet, value?: number) => void;
};

export type MetricsHistogram = {
  observe: (labels: LabelSet, value: number) => void;
};

export type MetricsGauge = {
  set: (labels: LabelSet, value: number) => void;
};

export type ObservabilityMetrics = {
  enabled: boolean;
  uploads: MetricsCounter;
  uploadDuration: MetricsHistogram;
  enrichment: MetricsCounter;
  enrichmentJobDuration: MetricsHistogram;
  playback: MetricsCounter;
  playerErrors: MetricsCounter;
  rateLimit: MetricsCounter;
  httpRequestDuration: MetricsHistogram;
  enrichmentQueueDepth: MetricsGauge;
  prismaQueryDuration: MetricsHistogram;
  processMemory: MetricsGauge;
  eventLoopLag: MetricsGauge;
  processHandles: MetricsGauge;
  render: () => string;
};

const noopCounter: MetricsCounter = {
  inc: () => {},
};

const noopHistogram: MetricsHistogram = {
  observe: () => {},
};

const noopGauge: MetricsGauge = {
  set: () => {},
};

const METRIC_HEADER = "text/plain; version=0.0.4; charset=utf-8";

function parseAddress(value: string): ipaddr.IPv4 | ipaddr.IPv6 | null {
  try {
    const parsed = ipaddr.parse(value);
    if (isIPv6Address(parsed) && parsed.isIPv4MappedAddress()) {
      return parsed.toIPv4Address();
    }

    return parsed;
  } catch {
    return null;
  }
}

function parseCidr(entry: string): [ipaddr.IPv4 | ipaddr.IPv6, number] | null {
  try {
    if (entry.includes("/")) {
      const [address, prefix] = ipaddr.parseCIDR(entry);
      if (isIPv6Address(address) && address.isIPv4MappedAddress()) {
        return [address.toIPv4Address(), Math.max(0, prefix - 96)];
      }

      return [address, prefix];
    }

    const address = ipaddr.parse(entry);
    if (isIPv6Address(address) && address.isIPv4MappedAddress()) {
      return [address.toIPv4Address(), 32];
    }

    return [address, address.kind() === "ipv4" ? 32 : 128];
  } catch {
    return null;
  }
}

function isAddressAllowed(
  address: string,
  allowedCidrs: readonly string[],
): boolean {
  if (!allowedCidrs || allowedCidrs.length === 0) {
    return true;
  }

  const parsedAddress = parseAddress(address);
  if (!parsedAddress) {
    return false;
  }

  return allowedCidrs.some((entry) => {
    const cidr = parseCidr(entry);
    if (!cidr) {
      return false;
    }

    const [network, prefix] = cidr;
    if (network.kind() !== parsedAddress.kind()) {
      return false;
    }

    return parsedAddress.match([network, prefix]);
  });
}

function formatLabels(labelNames: string[], labels: LabelSet): string {
  if (labelNames.length === 0) {
    return "";
  }

  const parts = labelNames.map((name) => {
    const value = labels[name] ?? "";
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `${name}="${escaped}"`;
  });

  return `{${parts.join(",")}}`;
}

class CounterMetric implements MetricsCounter {
  private readonly data = new Map<
    string,
    { labels: LabelSet; value: number }
  >();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[],
  ) {}

  inc(labels: LabelSet = {}, value = 1): void {
    const key = this.labelNames.map((label) => labels[label] ?? "").join("|");
    const current = this.data.get(key);
    if (current) {
      current.value += value;
    } else {
      this.data.set(key, { labels, value });
    }
  }

  render(): string {
    let output = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    if (this.data.size === 0) {
      output += `${this.name} 0\n`;
      return output;
    }

    for (const entry of this.data.values()) {
      output += `${this.name}${formatLabels(this.labelNames, entry.labels)} ${entry.value}\n`;
    }

    return output;
  }
}

class HistogramMetric implements MetricsHistogram {
  private readonly store = new Map<
    string,
    { labels: LabelSet; buckets: number[]; sum: number; count: number }
  >();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[],
    private readonly buckets: number[],
  ) {}

  observe(labels: LabelSet, value: number): void {
    const key = this.labelNames.map((label) => labels[label] ?? "").join("|");
    let record = this.store.get(key);
    if (!record) {
      record = {
        labels,
        buckets: new Array(this.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.store.set(key, record);
    }

    record.sum += value;
    record.count += 1;
    for (let index = 0; index < this.buckets.length; index += 1) {
      if (value <= this.buckets[index]) {
        record.buckets[index] += 1;
      }
    }
  }

  render(): string {
    let output = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    const formatBaseLabels = (labels: LabelSet) =>
      formatLabels(this.labelNames, labels);
    const formatBucketLabels = (labels: LabelSet, le: string) =>
      formatLabels([...this.labelNames, "le"], { ...labels, le });

    if (this.store.size === 0) {
      const bucketName = `${this.name}_bucket`;
      const emptyLabels = Object.fromEntries(
        this.labelNames.map((label) => [label, ""] as const),
      ) as LabelSet;

      for (const bucket of this.buckets) {
        output += `${bucketName}${formatBucketLabels(
          emptyLabels,
          bucket.toString(),
        )} 0\n`;
      }

      output += `${bucketName}${formatBucketLabels(emptyLabels, "+Inf")} 0\n`;
      output += `${this.name}_sum${formatBaseLabels(emptyLabels)} 0\n`;
      output += `${this.name}_count${formatBaseLabels(emptyLabels)} 0\n`;
      return output;
    }

    for (const record of this.store.values()) {
      const bucketName = `${this.name}_bucket`;
      for (let index = 0; index < this.buckets.length; index += 1) {
        output += `${bucketName}${formatBucketLabels(
          record.labels,
          this.buckets[index].toString(),
        )} ${record.buckets[index]}\n`;
      }
      output += `${bucketName}${formatBucketLabels(record.labels, "+Inf")} ${
        record.count
      }\n`;
      output += `${this.name}_sum${formatBaseLabels(record.labels)} ${record.sum}\n`;
      output += `${this.name}_count${formatBaseLabels(record.labels)} ${
        record.count
      }\n`;
    }

    return output;
  }
}

class GaugeMetric implements MetricsGauge {
  private readonly store = new Map<
    string,
    { labels: LabelSet; value: number }
  >();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[],
  ) {}

  set(labels: LabelSet, value: number): void {
    const key = this.labelNames.map((label) => labels[label] ?? "").join("|");
    this.store.set(key, { labels, value });
  }

  render(): string {
    let output = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} gauge\n`;
    if (this.store.size === 0) {
      output += `${this.name} 0\n`;
      return output;
    }

    for (const entry of this.store.values()) {
      output += `${this.name}${formatLabels(this.labelNames, entry.labels)} ${entry.value}\n`;
    }

    return output;
  }
}

function createMetrics(): ObservabilityMetrics {
  if (!env.METRICS_ENABLED) {
    return {
      enabled: false,
      uploads: noopCounter,
      uploadDuration: noopHistogram,
      enrichment: noopCounter,
      enrichmentJobDuration: noopHistogram,
      playback: noopCounter,
      playerErrors: noopCounter,
      rateLimit: noopCounter,
      httpRequestDuration: noopHistogram,
      enrichmentQueueDepth: noopGauge,
      prismaQueryDuration: noopHistogram,
      processMemory: noopGauge,
      eventLoopLag: noopGauge,
      processHandles: noopGauge,
      render: () => "Metrics disabled\n",
    };
  }

  const uploads = new CounterMetric(
    "treaz_upload_events_total",
    "Count of ROM and BIOS upload attempts grouped by status and reason",
    ["kind", "status", "reason"],
  );

  const uploadDuration = new HistogramMetric(
    "treaz_upload_duration_seconds",
    "Histogram of ROM and BIOS upload durations",
    ["kind", "status"],
    [1, 2.5, 5, 10, 30, 60, 120, 300],
  );

  const enrichment = new CounterMetric(
    "treaz_enrichment_requests_total",
    "Count of enrichment jobs enqueued",
    ["status"],
  );

  const enrichmentJobDuration = new HistogramMetric(
    "treaz_enrichment_job_duration_seconds",
    "ScreenScraper enrichment job latency broken down by phase",
    ["phase"],
    [5, 15, 30, 60, 120, 300, 600],
  );

  const playback = new CounterMetric(
    "treaz_playback_events_total",
    "Count of playback interactions recorded",
    ["action", "status", "route", "reason"],
  );

  const playerErrors = new CounterMetric(
    "treaz_player_errors_total",
    "Count of playback API failures grouped by operation and reason",
    ["operation", "reason"],
  );

  const rateLimit = new CounterMetric(
    "treaz_rate_limit_exceeded_total",
    "Count of rate limit rejections grouped by route and role",
    ["route", "role"],
  );

  const httpRequestDuration = new HistogramMetric(
    "treaz_http_request_duration_seconds",
    "Histogram of HTTP request durations",
    ["method", "route", "status_code"],
    [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  );

  const enrichmentQueueDepth = new GaugeMetric(
    "treaz_enrichment_queue_depth",
    "Depth of the ScreenScraper enrichment queue",
    [],
  );

  const prismaQueryDuration = new HistogramMetric(
    "treaz_prisma_query_duration_seconds",
    "Histogram of Prisma ORM query durations",
    ["model", "action", "outcome"],
    [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  );

  const processMemory = new GaugeMetric(
    "treaz_process_memory_bytes",
    "Node.js process memory usage in bytes",
    ["type"],
  );

  const eventLoopLag = new GaugeMetric(
    "treaz_process_event_loop_lag_seconds",
    "Observed Node.js event loop lag in seconds",
    ["stat"],
  );

  const processHandles = new GaugeMetric(
    "treaz_process_handles_total",
    "Active Node.js handles and requests",
    ["type"],
  );

  return {
    enabled: true,
    uploads,
    uploadDuration,
    enrichment,
    enrichmentJobDuration,
    playback,
    playerErrors,
    rateLimit,
    httpRequestDuration,
    enrichmentQueueDepth,
    prismaQueryDuration,
    processMemory,
    eventLoopLag,
    processHandles,
    render: () =>
      [
        uploads.render(),
        uploadDuration.render(),
        enrichment.render(),
        enrichmentJobDuration.render(),
        playback.render(),
        playerErrors.render(),
        rateLimit.render(),
        httpRequestDuration.render(),
        enrichmentQueueDepth.render(),
        prismaQueryDuration.render(),
        processMemory.render(),
        eventLoopLag.render(),
        processHandles.render(),
      ].join("\n"),
  };
}

function extractRouteLabel(request: FastifyRequest): string {
  const routeOptions = request.routeOptions as { urlPattern?: string };
  return (
    request.routeOptions.url ??
    routeOptions.urlPattern ??
    request.raw.url ??
    "unknown"
  );
}

async function handleMetricsRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  metrics: ObservabilityMetrics,
) {
  if (!metrics.enabled) {
    return reply.status(404).send({ message: "Metrics endpoint disabled" });
  }

  const hasAllowedCidrs = env.METRICS_ALLOWED_CIDRS.length > 0;
  const tokenConfigured = Boolean(env.METRICS_TOKEN);

  if (!hasAllowedCidrs && !tokenConfigured) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  if (
    hasAllowedCidrs &&
    !isAddressAllowed(request.ip, env.METRICS_ALLOWED_CIDRS)
  ) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  if (env.METRICS_TOKEN) {
    const authHeader = request.headers["authorization"];
    if (
      typeof authHeader !== "string" ||
      authHeader !== `Bearer ${env.METRICS_TOKEN}`
    ) {
      return reply.status(401).send({ message: "Unauthorized" });
    }
  }

  reply.header("content-type", METRIC_HEADER);
  reply.send(metrics.render());
}

export default fp(async (app: FastifyInstance) => {
  const metrics = createMetrics();
  app.decorate("metrics", metrics);

  if (metrics.enabled) {
    const loopMonitor = monitorEventLoopDelay({ resolution: 20 });
    loopMonitor.enable();

    const collectProcessMetrics = () => {
      const memory = process.memoryUsage();
      metrics.processMemory.set({ type: "rss" }, memory.rss);
      metrics.processMemory.set({ type: "heap_total" }, memory.heapTotal);
      metrics.processMemory.set({ type: "heap_used" }, memory.heapUsed);
      metrics.processMemory.set({ type: "external" }, memory.external);
      metrics.processMemory.set({ type: "array_buffers" }, memory.arrayBuffers);

      const handles = (
        (
          process as typeof process & { _getActiveHandles?: () => unknown[] }
        )._getActiveHandles?.() ?? []
      ).length;
      const requests = (
        (
          process as typeof process & { _getActiveRequests?: () => unknown[] }
        )._getActiveRequests?.() ?? []
      ).length;

      metrics.processHandles.set({ type: "handles" }, handles);
      metrics.processHandles.set({ type: "requests" }, requests);

      metrics.eventLoopLag.set(
        { stat: "mean" },
        loopMonitor.mean / 1_000_000_000,
      );
      metrics.eventLoopLag.set(
        { stat: "p50" },
        loopMonitor.percentile(50) / 1_000_000_000,
      );
      metrics.eventLoopLag.set(
        { stat: "p90" },
        loopMonitor.percentile(90) / 1_000_000_000,
      );
      metrics.eventLoopLag.set(
        { stat: "p99" },
        loopMonitor.percentile(99) / 1_000_000_000,
      );
      metrics.eventLoopLag.set(
        { stat: "max" },
        loopMonitor.max / 1_000_000_000,
      );

      loopMonitor.reset();
    };

    collectProcessMetrics();
    const metricInterval = setInterval(collectProcessMetrics, 5000);

    app.addHook("onRequest", (request, _reply, done) => {
      request.metricsStartTime = process.hrtime.bigint();
      done();
    });

    app.addHook("onResponse", (request, reply, done) => {
      if (request.routeOptions.url === "/metrics") {
        return done();
      }

      const start = request.metricsStartTime;
      if (start) {
        const durationSeconds =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;
        metrics.httpRequestDuration.observe(
          {
            method: request.method,
            route: extractRouteLabel(request),
            status_code: reply.statusCode?.toString() ?? "0",
          },
          durationSeconds,
        );
      }

      done();
    });

    app.addHook("onClose", async () => {
      clearInterval(metricInterval);
      loopMonitor.disable();
    });
  }

  app.get("/metrics", async (request, reply) => {
    await handleMetricsRequest(request, reply, metrics);
  });
});
