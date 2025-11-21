import { IncomingMessage, ServerResponse } from 'node:http';

import { metrics, type Counter, type UpDownCounter } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ExportResultCode } from '@opentelemetry/core';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { resourceFromAttributes, type Resource } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import type { Env } from './env';
import type {
  SeverityNumber,
  AnyValue,
  AnyValueMap,
  Logger as OtelLogger,
} from '@opentelemetry/api-logs';
import type { ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

type OtelLogsModule = typeof import('@opentelemetry/api-logs');

let otelLogsModule: OtelLogsModule | null = null;
let hasAttemptedOtelLogsLoad = false;
let hasLoggedOtelFallback = false;

const loadOtelLogsModule = (): OtelLogsModule | null => {
  if (hasAttemptedOtelLogsLoad) {
    return otelLogsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    otelLogsModule = require('@opentelemetry/api-logs');
  } catch (error) {
    if (!hasLoggedOtelFallback) {
      console.warn(
        '[otel] structured logging disabled because @opentelemetry/api-logs could not be loaded',
        error,
      );
      hasLoggedOtelFallback = true;
    }
    otelLogsModule = null;
  }

  hasAttemptedOtelLogsLoad = true;

  return otelLogsModule;
};

class NoopSpanExporter implements SpanExporter {
  export(_spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

type RuntimeMetrics = {
  authAttempts: Counter;
  romUploads: Counter;
  activeSessions: UpDownCounter;
};

export type AuthAttemptOutcome = 'success' | 'failure';

let sdk: NodeSDK | null = null;
let prometheusExporter: PrometheusExporter | null = null;
let loggerProvider: LoggerProvider | null = null;
let structuredLogger: OtelLogger | null = null;
let runtimeMetrics: RuntimeMetrics | null = null;
let severityLookup:
  | Record<NonNullable<StructuredLogInput['level']>, SeverityNumber>
  | null
  | undefined;

const buildResourceAttributes = (env: Env) => ({
  [SemanticResourceAttributes.SERVICE_NAME]: 'treazrisland-backend',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
});

const hasCustomOtelConfig = (): boolean =>
  Boolean(
    process.env.OTEL_TRACES_EXPORTER ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
  );

const createExporter = (env: Env): SpanExporter | undefined => {
  if (env.NODE_ENV === 'development') {
    return new ConsoleSpanExporter();
  }

  if (hasCustomOtelConfig()) {
    return undefined;
  }

  return new NoopSpanExporter();
};

const shouldStartObservability = (env: Env): boolean => {
  if (env.NODE_ENV === 'test' && !hasCustomOtelConfig()) {
    return false;
  }

  return true;
};

const ensurePrometheusExporter = (): PrometheusExporter => {
  if (!prometheusExporter) {
    prometheusExporter = new PrometheusExporter({ endpoint: '/metrics' }, (error: Error | void) => {
      if (error) {
        console.error('[otel] failed to start Prometheus exporter', error);
      }
    });
  }

  return prometheusExporter;
};

const initializeLoggerProvider = (resource: Resource): void => {
  if (loggerProvider) {
    return;
  }

  const apiLogs = loadOtelLogsModule();
  if (!apiLogs) {
    return;
  }

  loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor(new ConsoleLogRecordExporter())],
  });
  apiLogs.logs.setGlobalLoggerProvider(loggerProvider);
  structuredLogger = apiLogs.logs.getLogger('treazrisland-backend');
};

const initializeRuntimeMetrics = (): void => {
  const meter = metrics.getMeter('treazrisland-backend');
  runtimeMetrics = {
    authAttempts: meter.createCounter('treazr_auth_attempts_total', {
      description: 'Counts every authentication attempt grouped by method and outcome',
    }),
    romUploads: meter.createCounter('treazr_rom_uploads_total', {
      description: 'Counts ROM upload attempts grouped by source and outcome',
    }),
    activeSessions: meter.createUpDownCounter('treazr_active_sessions', {
      description: 'Tracks refresh-token sessions currently stored in Redis',
    }),
  };
};

type StructuredLogInput = {
  event: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  requestId?: string;
  route?: string;
  data?: Record<string, unknown>;
};

const ensureSeverityLookup = () => {
  if (severityLookup !== undefined) {
    return severityLookup;
  }

  const apiLogs = loadOtelLogsModule();
  if (!apiLogs) {
    severityLookup = null;
    return severityLookup;
  }

  severityLookup = {
    debug: apiLogs.SeverityNumber.DEBUG,
    info: apiLogs.SeverityNumber.INFO,
    warn: apiLogs.SeverityNumber.WARN,
    error: apiLogs.SeverityNumber.ERROR,
  } satisfies Record<NonNullable<StructuredLogInput['level']>, SeverityNumber>;

  return severityLookup;
};

function buildAnyValueMap(input: Record<string, unknown>): AnyValueMap {
  const entries: Array<readonly [string, AnyValue]> = [];
  for (const [key, value] of Object.entries(input)) {
    const normalized = toAnyValue(value);
    if (normalized !== undefined) {
      entries.push([key, normalized]);
    }
  }

  return Object.fromEntries(entries) as AnyValueMap;
}

function toAnyValue(value: unknown): AnyValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toAnyValue(item))
      .filter((item): item is AnyValue => item !== undefined);
  }

  if (typeof value === 'object' && value) {
    return buildAnyValueMap(value as Record<string, unknown>);
  }

  return undefined;
}

export const emitStructuredLog = (entry: StructuredLogInput): void => {
  const severityMap = ensureSeverityLookup();
  if (!structuredLogger || !severityMap) {
    return;
  }

  const level = entry.level ?? 'info';
  const severityNumber = severityMap[level];
  const attributes = buildAnyValueMap({
    requestId: entry.requestId,
    route: entry.route,
    ...entry.data,
  });

  structuredLogger.emit({
    eventName: entry.event,
    severityNumber,
    severityText: level.toUpperCase(),
    body: buildAnyValueMap({
      event: entry.event,
      level,
      data: entry.data ?? {},
    }),
    attributes,
  });
};

export const recordAuthAttempt = (details: {
  method: string;
  outcome: AuthAttemptOutcome;
}): void => {
  runtimeMetrics?.authAttempts.add(1, {
    method: details.method,
    outcome: details.outcome,
  });
};

export const recordRomUpload = (details: {
  source?: string;
  outcome: AuthAttemptOutcome;
}): void => {
  runtimeMetrics?.romUploads.add(1, {
    source: details.source ?? 'unknown',
    outcome: details.outcome,
  });
};

export const incrementActiveSessions = (): void => {
  runtimeMetrics?.activeSessions.add(1);
};

export const decrementActiveSessions = (): void => {
  runtimeMetrics?.activeSessions.add(-1);
};

export const respondWithMetricsSnapshot = (
  request: IncomingMessage,
  response: ServerResponse,
): boolean => {
  if (!prometheusExporter) {
    return false;
  }

  prometheusExporter.getMetricsRequestHandler(request, response);
  return true;
};

export const hasMetricsExporter = (): boolean => Boolean(prometheusExporter);

export const startObservability = (env: Env): void => {
  if (sdk || !shouldStartObservability(env)) {
    return;
  }

  const resource = resourceFromAttributes(buildResourceAttributes(env));
  initializeLoggerProvider(resource);
  const metricReader = ensurePrometheusExporter();

  sdk = new NodeSDK({
    traceExporter: createExporter(env),
    resource,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fastify': {
          enabled: false,
        },
      }),
      new FastifyInstrumentation(),
    ],
  });

  try {
    sdk.start();
    initializeRuntimeMetrics();
    if (env.NODE_ENV === 'development') {
      console.info('[otel] tracing and metrics initialized');
    }
  } catch (error: unknown) {
    console.error('[otel] failed to start SDK', error);
  }
};

export const stopObservability = async (): Promise<void> => {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;

  if (prometheusExporter) {
    await prometheusExporter.stopServer();
    prometheusExporter = null;
  }

  if (loggerProvider) {
    await loggerProvider.shutdown();
    loggerProvider = null;
    structuredLogger = null;
  }

  runtimeMetrics = null;
};
