import type { MetricsRecorder } from './metrics.recorder';

declare module 'fastify' {
  interface FastifyInstance {
    metricsRecorder: MetricsRecorder;
  }
}
