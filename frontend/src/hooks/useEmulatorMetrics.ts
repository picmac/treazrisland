import { useEffect } from 'react';

import { publishMetricsEvent } from '@/lib/metrics';

type Options = {
  romId: string;
  romTitle?: string;
  enabled: boolean;
  sampleIntervalMs?: number;
};

type PerformanceMemory = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
  totalJSHeapSize?: number;
};

type PerformanceWithMemory = Performance & { memory?: PerformanceMemory };

const toMegabytes = (bytes: number): number => Number((bytes / 1_048_576).toFixed(2));

const readMemorySnapshot = (): { used?: number; total?: number } => {
  if (typeof performance === 'undefined') return {};
  const runtime = performance as PerformanceWithMemory;
  const memory = runtime.memory;

  if (!memory) return {};

  const used = toMegabytes(memory.usedJSHeapSize);
  const total = memory.totalJSHeapSize ?? memory.jsHeapSizeLimit;
  return { used, total: toMegabytes(total) };
};

export function useEmulatorMetrics({ romId, romTitle, enabled, sampleIntervalMs = 5000 }: Options) {
  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined' || typeof performance === 'undefined') return undefined;

    let frameCount = 0;
    let animationFrame: number | null = null;
    let intervalId: number | null = null;
    let lastSampleAt = performance.now();

    const scheduleNextFrame = () => {
      animationFrame = window.requestAnimationFrame(() => {
        frameCount += 1;
        scheduleNextFrame();
      });
    };

    const publishSample = async () => {
      const now = performance.now();
      const durationMs = Math.max(1, now - lastSampleAt);
      const fps = Number(((frameCount * 1000) / durationMs).toFixed(2));
      const memory = readMemorySnapshot();
      const samples = Math.max(1, frameCount || Math.round((durationMs / 1000) * fps));

      frameCount = 0;
      lastSampleAt = now;

      await publishMetricsEvent({
        type: 'emulator-performance',
        romId,
        romTitle,
        fps,
        samples,
        memoryUsedMB: memory.used,
        memoryTotalMB: memory.total,
        intervalMs: Math.round(durationMs),
        clientTimestamp: new Date().toISOString(),
      });
    };

    const startLoop = () => {
      if (animationFrame === null) {
        scheduleNextFrame();
      }
      if (intervalId === null) {
        intervalId = window.setInterval(publishSample, Math.max(1000, sampleIntervalMs));
      }
    };

    const stopLoop = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        lastSampleAt = performance.now();
        startLoop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startLoop();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopLoop();
      void publishSample();
    };
  }, [enabled, romId, romTitle, sampleIntervalMs]);
}
