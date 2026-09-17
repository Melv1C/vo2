import { describe, expect, test } from "bun:test";

import { normalizePlannedWorkoutRange } from "./planned-workouts-range";

describe("normalizePlannedWorkoutRange", () => {
  test("defaults to a 31-day window starting today", () => {
    expect(normalizePlannedWorkoutRange({ from: "2026-09-17" })).toEqual({
      from: "2026-09-17",
      to: "2026-10-17",
    });
  });

  test("rejects reversed ranges", () => {
    expect(() => normalizePlannedWorkoutRange({ from: "2026-09-18", to: "2026-09-17" })).toThrow(
      "Planned workout date range is invalid",
    );
  });

  test("rejects ranges longer than one year", () => {
    expect(() => normalizePlannedWorkoutRange({ from: "2026-01-01", to: "2027-01-02" })).toThrow(
      "cannot exceed 366 days",
    );
  });
});
