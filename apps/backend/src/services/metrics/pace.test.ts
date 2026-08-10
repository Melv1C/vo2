import { describe, expect, test } from "bun:test";

import { computeRunningMetrics, gradeAdjustedSpeed, minettiCost } from "./pace";
import { sanitizeStream } from "./sanitize-stream";

describe("minettiCost", () => {
  test("increases cost on positive grade", () => {
    expect(minettiCost(0.1)).toBeGreaterThan(minettiCost(0));
  });
});

describe("gradeAdjustedSpeed", () => {
  test("raises GAP on climbs versus flat running speed", () => {
    const flatGap = gradeAdjustedSpeed(3, 0);
    const climbGap = gradeAdjustedSpeed(3, 0.1);

    expect(climbGap).toBeGreaterThan(flatGap);
  });
});

describe("computeRunningMetrics", () => {
  test("computes NGP and rTSS for a steady run at threshold pace", () => {
    const stream = sanitizeStream({
      timeS: Array.from({ length: 3600 }, (_, index) => index),
      velocityMps: Array.from({ length: 3600 }, () => 3.26),
      heartrate: Array.from({ length: 3600 }, () => 170),
      moving: Array.from({ length: 3600 }, () => true),
    });

    const result = computeRunningMetrics({
      stream,
      athlete: {
        userId: "user-1",
        maxHr: 200,
        restingHr: 65,
        lthr: 182,
        ftp: 300,
        thresholdPaceMps: 3.26,
        weightKg: 77,
        heightCm: 180,
        birthdate: "2004-08-10",
        sex: "M",
      },
      sportFamily: "running",
      deviceWatts: false,
    });

    expect(result.sportPayload?.ngpMps).toBeCloseTo(3.26, 1);
    expect(result.sportPayload?.rTss).toBeCloseTo(100, 1);
    expect(result.energyKcal).toBeGreaterThan(0);
  });

  test("ignores running watch power even when watts are present", () => {
    const stream = sanitizeStream({
      timeS: Array.from({ length: 120 }, (_, index) => index),
      velocityMps: Array.from({ length: 120 }, () => 3.2),
      watts: Array.from({ length: 120 }, () => 220),
      heartrate: Array.from({ length: 120 }, () => 165),
      moving: Array.from({ length: 120 }, () => true),
    });

    const result = computeRunningMetrics({
      stream,
      athlete: {
        userId: "user-1",
        maxHr: 200,
        restingHr: 65,
        lthr: 182,
        ftp: 300,
        thresholdPaceMps: 3.26,
        weightKg: 77,
        heightCm: 180,
        birthdate: "2004-08-10",
        sex: "M",
      },
      sportFamily: "running",
      deviceWatts: true,
    });

    expect(result.sportPayload?.ngpMps).toBeGreaterThan(0);
    expect(result.sportPayload).not.toHaveProperty("np");
  });
});
