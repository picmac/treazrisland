import { IncomingMessage, ServerResponse } from 'node:http';

import { metrics, type Counter, type UpDownCounter } from '@opentelemetry/api';
import {
  SeverityNumber,
  logs as otelLogs,
  type Logger as OtelLogger,
} from '@opentelemetry/api-logs';
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
import type { ExportResult } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

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
    prometheusExporter = new PrometheusExporter({ endpoint: '/metrics' }, (error) => {
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

  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(new ConsoleLogRecordExporter()));
  otelLogs.setGlobalLoggerProvider(loggerProvider);
  structuredLogger = otelLogs.getLogger('treazrisland-backend');
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

const severityLookup: Record<NonNullable<StructuredLogInput['level']>, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

const sanitizeAttributes = (input: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
};

export const emitStructuredLog = (entry: StructuredLogInput): void => {
  if (!structuredLogger) {
    return;
  }

  const level = entry.level ?? 'info';
  const severityNumber = severityLookup[level];
  const attributes = sanitizeAttributes({
    requestId: entry.requestId,
    route: entry.route,
    ...entry.data,
  });

  structuredLogger.emit({
    eventName: entry.event,
    severityNumber,
    severityText: level.toUpperCase(),
    body: {
      event: entry.event,
      level,
      data: entry.data ?? {},
    },
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

  sdk
    .start()
    .then(() => {
      initializeRuntimeMetrics();
      if (env.NODE_ENV === 'development') {
        console.info('[otel] tracing and metrics initialized');
      }
    })
    .catch((error) => {
      console.error('[otel] failed to start SDK', error);
    });
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
