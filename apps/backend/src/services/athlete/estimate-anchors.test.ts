import { describe, expect, test } from "bun:test";

import { bestRollingMean } from "./rolling-window";

describe("bestRollingMean", () => {
  test("finds the highest rolling mean inside the window", () => {
    const points = [
      ...Array.from({ length: 20 }, (_, index) => ({ timeS: index, value: 150 })),
      ...Array.from({ length: 15 }, (_, index) => ({ timeS: 20 + index, value: 180 })),
    ];

    const result = bestRollingMean(points, 10);
    expect(result).not.toBeNull();
    expect(result!.mean).toBe(180);
  });

  test("returns null when the series is shorter than the window", () => {
    const points = [
      { timeS: 0, value: 150 },
      { timeS: 1, value: 155 },
    ];

    expect(bestRollingMean(points, 60)).toBeNull();
  });
});
