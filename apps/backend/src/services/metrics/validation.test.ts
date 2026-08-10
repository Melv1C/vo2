import { describe, expect, test } from "bun:test";

import { validateSportLoadGating } from "./validation";

describe("validateSportLoadGating", () => {
  test("flags power TSS on runs", () => {
    expect(
      validateSportLoadGating({
        sportFamily: "running",
        loadSource: "tss",
        sportPayload: null,
      }),
    ).toContain("running_activity_used_power_tss");
  });

  test("flags sport-specific load on walks", () => {
    expect(
      validateSportLoadGating({
        sportFamily: "walking",
        loadSource: "r_tss",
        sportPayload: null,
      }),
    ).toContain("non_run_activity_used_sport_specific_load");
  });

  test("allows hr_tss on walks", () => {
    expect(
      validateSportLoadGating({
        sportFamily: "walking",
        loadSource: "hr_tss",
        sportPayload: null,
      }),
    ).toEqual([]);
  });
});
