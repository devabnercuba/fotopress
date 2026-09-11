import { describe, it, expect } from "vitest";
import { mapConcurrent, chunk } from "./async-pool";

describe("async-pool utilities", () => {
  it("chunks arrays correctly", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("executes tasks with concurrency limit while preserving order", async () => {
    const items = [1, 2, 3, 4, 5, 6];
    let activeTasks = 0;
    let maxActive = 0;

    const results = await mapConcurrent(items, 3, async (num) => {
      activeTasks++;
      maxActive = Math.max(maxActive, activeTasks);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeTasks--;
      return num * 10;
    });

    expect(results).toEqual([10, 20, 30, 40, 50, 60]);
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThanOrEqual(1);
  });
});
