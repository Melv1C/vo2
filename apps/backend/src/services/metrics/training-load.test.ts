import { describe, expect, test } from "bun:test";

import { buildDailyLoadSeries } from "./training-load";

describe("buildDailyLoadSeries", () => {
  test("fills gaps between active days with zero-load rest days", () => {
    const series = buildDailyLoadSeries([
      { date: "2025-01-01", trainingLoad: 100, activityCount: 1 },
      { date: "2025-01-03", trainingLoad: 50, activityCount: 1 },
    ]);

    expect(series).toHaveLength(3);
    expect(series[1]?.trainingLoad).toBe(0);
    expect(series[1]?.activityCount).toBe(0);
  });

  test("marks the first 42 days as ramping", () => {
    const dailyLoads = Array.from({ length: 50 }, (_, index) => {
      const date = new Date("2025-01-01T00:00:00.000Z");
      date.setUTCDate(date.getUTCDate() + index);
      return {
        date: date.toISOString().slice(0, 10),
        trainingLoad: 50,
        activityCount: 1,
      };
    });

    const series = buildDailyLoadSeries(dailyLoads);
    expect(series[0]?.isRamping).toBe(true);
    expect(series[41]?.isRamping).toBe(true);
    expect(series[42]?.isRamping).toBe(false);
  });
});
