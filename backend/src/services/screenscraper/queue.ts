export class ScreenScraperQueue {
  private readonly concurrency: number;
  private readonly requestsPerInterval: number;
  private readonly intervalMs: number;
  private running = 0;
  private queue: Array<{
    execute: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];
  private requestTimestamps: number[] = [];
  private readonly onQueueDepthChange?: (depth: number) => void;

  constructor(options: {
    concurrency: number;
    requestsPerMinute: number;
    onQueueDepthChange?: (depth: number) => void;
  }) {
    this.concurrency = Math.max(1, options.concurrency);
    this.requestsPerInterval = Math.max(1, options.requestsPerMinute);
    this.intervalMs = 60_000;
    this.onQueueDepthChange = options.onQueueDepthChange;
    this.reportDepth();
  }

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: task as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.reportDepth();
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    if (this.running >= this.concurrency) {
      return;
    }

    if (!this.canIssueRequest()) {
      const delay = this.computeDelay();
      setTimeout(() => this.processQueue(), delay);
      return;
    }

    const job = this.queue.shift();
    if (!job) {
      return;
    }

    this.reportDepth();
    this.running += 1;
    this.requestTimestamps.push(Date.now());

    job
      .execute()
      .then((result) => {
        job.resolve(result);
      })
      .catch((error) => {
        job.reject(error);
      })
      .finally(() => {
        this.running -= 1;
        this.trimTimestamps();
        this.processQueue();
        this.reportDepth();
      });
  }

  private canIssueRequest(): boolean {
    this.trimTimestamps();
    return this.requestTimestamps.length < this.requestsPerInterval;
  }

  private computeDelay(): number {
    this.trimTimestamps();
    if (this.requestTimestamps.length < this.requestsPerInterval) {
      return 0;
    }

    const windowStart = this.requestTimestamps[0] ?? Date.now();
    const elapsed = Date.now() - windowStart;
    return Math.max(0, this.intervalMs - elapsed);
  }

  private trimTimestamps(): void {
    const threshold = Date.now() - this.intervalMs;
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => timestamp >= threshold);
  }

  private reportDepth(): void {
    this.onQueueDepthChange?.(this.queue.length);
  }
}
