import { describe, expect, test } from "bun:test";

import { normalizeTrainingStatsRange } from "./training-stats-range";

describe("normalizeTrainingStatsRange", () => {
  test("defaults to a 91-day inclusive range ending on the requested date", () => {
    expect(normalizeTrainingStatsRange({ to: "2026-09-03" })).toEqual({
      from: "2026-06-05",
      to: "2026-09-03",
    });
  });

  test("rejects reversed ranges", () => {
    expect(() => normalizeTrainingStatsRange({ from: "2026-09-04", to: "2026-09-03" })).toThrow(
      "Training stats range is invalid",
    );
  });

  test("rejects ranges longer than two years", () => {
    expect(() => normalizeTrainingStatsRange({ from: "2024-01-01", to: "2026-01-01" })).toThrow(
      "cannot exceed 731 days",
    );
  });
});
