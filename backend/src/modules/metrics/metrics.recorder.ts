import { metrics, type Histogram } from '@opentelemetry/api';

import type { EmulatorPerformanceEvent } from './metrics.store';
import { MetricsStore } from './metrics.store';

export type MetricsEvent = { type: 'emulator-performance' } & EmulatorPerformanceEvent;

export class MetricsRecorder {
  private readonly fpsHistogram: Histogram;
  private readonly memoryHistogram: Histogram;

  constructor(private readonly store: MetricsStore) {
    const meter = metrics.getMeter('treazrisland-backend');
    this.fpsHistogram = meter.createHistogram('treazr_emulator_fps', {
      description: 'Frame rate samples reported by EmulatorJS clients',
      unit: 'frames',
    });
    this.memoryHistogram = meter.createHistogram('treazr_emulator_memory_used_mb', {
      description: 'Heap usage reported by EmulatorJS clients',
      unit: 'megabytes',
    });
  }

  async ingest(event: MetricsEvent): Promise<void> {
    if (event.type === 'emulator-performance') {
      const attributes = { rom_id: event.romId };
      this.fpsHistogram.record(event.fps, attributes);

      if (event.memoryUsedMB !== undefined) {
        this.memoryHistogram.record(event.memoryUsedMB, attributes);
      }

      await this.store.recordEmulatorPerformance(event);
    }
  }
}
