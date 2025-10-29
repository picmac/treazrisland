import { describe, expect, it } from "vitest";
import { ScreenScraperQueue } from "./queue.js";

describe("ScreenScraperQueue", () => {
  it("limits concurrent task execution", async () => {
    const queue = new ScreenScraperQueue({ concurrency: 2, requestsPerMinute: 120 });

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
});
