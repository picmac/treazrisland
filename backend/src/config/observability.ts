import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import type { Env } from './env';

let sdk: NodeSDK | null = null;

class NoopSpanExporter implements SpanExporter {
  export(_spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

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

export const startObservability = (env: Env): void => {
  if (sdk || !shouldStartObservability(env)) {
    return;
  }

  sdk = new NodeSDK({
    traceExporter: createExporter(env),
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: 'treazrisland-backend',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
    }),
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
    if (env.NODE_ENV === 'development') {
      console.info('[otel] tracing initialized');
    }
  } catch (error) {
    console.error('[otel] failed to start SDK', error);
  }
};

export const stopObservability = async (): Promise<void> => {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  sdk = null;
};
