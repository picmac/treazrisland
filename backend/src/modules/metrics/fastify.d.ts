/* eslint-disable @typescript-eslint/no-unused-vars */
import type { MetricsRecorder } from './metrics.recorder';

declare module 'fastify' {
  interface FastifyInstance {
    metricsRecorder: MetricsRecorder;
  }
}
