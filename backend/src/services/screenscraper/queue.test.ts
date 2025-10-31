import { describe, expect, it, vi } from "vitest";
import { ScreenScraperQueue } from "./queue.js";

describe("ScreenScraperQueue", () => {
  it("limits concurrent task execution", async () => {
    const queue = new ScreenScraperQueue({
      concurrency: 2,
      requestsPerMinute: 120,
    });

    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 8 }).map((_, index) =>
      queue.enqueue(async () => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        return index;
      })
    );

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(8);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });

  it("notifies listeners when the queue depth changes", async () => {
    const depthSpy = vi.fn();
    const queue = new ScreenScraperQueue({
      concurrency: 1,
      requestsPerMinute: 120,
      onQueueDepthChange: depthSpy,
    });

    const taskOne = queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });

    const taskTwo = queue.enqueue(async () => {});

    await Promise.all([taskOne, taskTwo]);

    expect(depthSpy).toHaveBeenCalled();
    expect(depthSpy).toHaveBeenCalledWith(0);
    expect(depthSpy.mock.calls.some(([value]) => value > 0)).toBe(true);
  });
});
