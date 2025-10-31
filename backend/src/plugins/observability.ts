import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
  enrichment: MetricsCounter;
  playback: MetricsCounter;
  rateLimit: MetricsCounter;
  httpRequestDuration: MetricsHistogram;
  enrichmentQueueDepth: MetricsGauge;
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
    if (this.store.size === 0) {
      const labels = formatLabels(this.labelNames, {});
      const bucketName = `${this.name}_bucket`;
      for (const bucket of this.buckets) {
        output += `${bucketName}${labels}{le="${bucket}"} 0\n`;
      }
      output += `${bucketName}${labels}{le="+Inf"} 0\n`;
      output += `${this.name}_sum${labels} 0\n${this.name}_count${labels} 0\n`;
      return output;
    }

    for (const record of this.store.values()) {
      const baseLabels = formatLabels(this.labelNames, record.labels);
      const bucketName = `${this.name}_bucket`;
      for (let index = 0; index < this.buckets.length; index += 1) {
        const bucketLabels = `${baseLabels.length > 0 ? baseLabels.slice(0, -1) + "," : "{"}le="${this.buckets[index]}"}`;
        output += `${bucketName}${bucketLabels} ${record.buckets[index]}\n`;
      }
      const infLabels = `${baseLabels.length > 0 ? baseLabels.slice(0, -1) + "," : "{"}le="+Inf"}`;
      output += `${bucketName}${infLabels} ${record.count}\n`;
      output += `${this.name}_sum${baseLabels} ${record.sum}\n`;
      output += `${this.name}_count${baseLabels} ${record.count}\n`;
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
      enrichment: noopCounter,
      playback: noopCounter,
      rateLimit: noopCounter,
      httpRequestDuration: noopHistogram,
      enrichmentQueueDepth: noopGauge,
      render: () => "Metrics disabled\n",
    };
  }

  const uploads = new CounterMetric(
    "treaz_upload_events_total",
    "Count of ROM and BIOS upload attempts grouped by status",
    ["kind", "status"],
  );

  const enrichment = new CounterMetric(
    "treaz_enrichment_requests_total",
    "Count of enrichment jobs enqueued",
    ["status"],
  );

  const playback = new CounterMetric(
    "treaz_playback_events_total",
    "Count of playback interactions recorded",
    ["action", "status"],
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

  return {
    enabled: true,
    uploads,
    enrichment,
    playback,
    rateLimit,
    httpRequestDuration,
    enrichmentQueueDepth,
    render: () =>
      [
        uploads.render(),
        enrichment.render(),
        playback.render(),
        rateLimit.render(),
        httpRequestDuration.render(),
        enrichmentQueueDepth.render(),
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

  if (!isAddressAllowed(request.ip, env.METRICS_ALLOWED_CIDRS)) {
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
  }

  app.get("/metrics", async (request, reply) => {
    await handleMetricsRequest(request, reply, metrics);
  });
});
