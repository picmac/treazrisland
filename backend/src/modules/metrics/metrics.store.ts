import type { Redis } from 'ioredis';

export type EmulatorPerformanceEvent = {
  romId: string;
  romTitle?: string;
  fps: number;
  samples?: number;
  memoryUsedMB?: number;
  memoryTotalMB?: number;
  intervalMs?: number;
  clientTimestamp?: string;
};

const ONE_MINUTE_MS = 60_000;
const DEFAULT_TTL_SECONDS = 60 * 60; // one hour of retention for rollups

const toMinuteBucket = (timestamp: number): number =>
  Math.floor(timestamp / ONE_MINUTE_MS) * ONE_MINUTE_MS;

export class MetricsStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ) {}

  async recordEmulatorPerformance(event: EmulatorPerformanceEvent): Promise<void> {
    const parsedTimestamp = event.clientTimestamp ? Date.parse(event.clientTimestamp) : Date.now();
    const timestamp = Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp;
    const bucket = toMinuteBucket(timestamp);
    const bucketKey = `metrics:emulator:fps:${bucket}:${event.romId}`;
    const globalKey = `metrics:emulator:fps:${bucket}:global`;
    const latestKey = `metrics:emulator:latest:${event.romId}`;

    const sampleCount = Math.max(1, Math.round(event.samples ?? 1));
    const intervalMs = Math.round(
      event.intervalMs ??
        (event.fps > 0 ? (sampleCount / event.fps) * 1000 : sampleCount * (1000 / 60)),
    );
    const pipeline = this.redis.multi();

    pipeline.hset(bucketKey, {
      romId: event.romId,
      romTitle: event.romTitle ?? '',
      intervalMs,
    });
    pipeline.hincrbyfloat(bucketKey, 'fpsSum', event.fps * sampleCount);
    pipeline.hincrby(bucketKey, 'samples', sampleCount);
    pipeline.hincrby(bucketKey, 'durationMs', intervalMs);

    if (event.memoryUsedMB !== undefined) {
      pipeline.hincrbyfloat(bucketKey, 'memorySum', event.memoryUsedMB);
      pipeline.hincrby(bucketKey, 'memorySamples', 1);
      pipeline.hset(bucketKey, 'memoryLatest', event.memoryUsedMB);
    }

    if (event.memoryTotalMB !== undefined) {
      pipeline.hset(bucketKey, 'memoryTotal', event.memoryTotalMB);
    }

    pipeline.expire(bucketKey, this.ttlSeconds);

    pipeline.hincrbyfloat(globalKey, 'fpsSum', event.fps * sampleCount);
    pipeline.hincrby(globalKey, 'samples', sampleCount);
    pipeline.hincrby(globalKey, 'durationMs', intervalMs);
    pipeline.expire(globalKey, this.ttlSeconds);

    pipeline.hset(latestKey, {
      fps: event.fps,
      samples: sampleCount,
      memoryUsedMB: event.memoryUsedMB ?? '',
      memoryTotalMB: event.memoryTotalMB ?? '',
      recordedAt: new Date(timestamp).toISOString(),
    });
    pipeline.expire(latestKey, this.ttlSeconds);

    await pipeline.exec();
  }

  async getLatestSample(romId: string): Promise<Record<string, string>> {
    const latestKey = `metrics:emulator:latest:${romId}`;
    return this.redis.hgetall(latestKey);
  }
}
