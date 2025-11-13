import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

import type { Env } from './env';

let sdk: NodeSDK | null = null;

const createExporter = (env: Env) => {
  if (env.NODE_ENV !== 'development') {
    return undefined;
  }

  return new ConsoleSpanExporter();
};

export const startObservability = (env: Env): void => {
  if (sdk) {
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
