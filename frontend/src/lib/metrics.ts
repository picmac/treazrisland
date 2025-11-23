import { API_BASE_URL } from '@/lib/apiClient';

export type EmulatorPerformancePayload = {
  type: 'emulator-performance';
  romId: string;
  romTitle?: string;
  fps: number;
  samples?: number;
  memoryUsedMB?: number;
  memoryTotalMB?: number;
  intervalMs?: number;
  clientTimestamp?: string;
};

export async function publishMetricsEvent(payload: EmulatorPerformancePayload): Promise<void> {
  const endpoint = `${API_BASE_URL}/metrics/events`;
  const body = JSON.stringify(payload);

  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' });
      const delivered = navigator.sendBeacon(endpoint, blob);
      if (delivered) {
        return;
      }
    }
  } catch (error) {
    console.warn('[metrics] sendBeacon fallback triggered', error);
  }

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('[metrics] failed to publish payload', error);
  }
}
