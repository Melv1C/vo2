import { describe, expect, test } from "bun:test";

import { cyclingModule, computeCyclingMetrics } from "./power";
import { sanitizeStream } from "./sanitize-stream";

describe("computeCyclingMetrics", () => {
  test("computes NP and TSS for a steady power-meter ride", () => {
    const stream = sanitizeStream({
      timeS: Array.from({ length: 3600 }, (_, index) => index),
      watts: Array.from({ length: 3600 }, () => 250),
      heartrate: Array.from({ length: 3600 }, () => 150),
      moving: Array.from({ length: 3600 }, () => true),
    });

    const result = computeCyclingMetrics({
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
      sportFamily: "cycling",
      deviceWatts: true,
    });

    expect(result.sportPayload).toBeDefined();
    expect(result.sportPayload?.np).toBeCloseTo(250, 0);
    expect(result.sportPayload?.intensityFactor).toBeCloseTo(250 / 300, 2);
    expect(result.sportPayload?.tss).toBeCloseTo(69.4, 0);
    expect(result.energyKcal).toBeGreaterThan(0);
  });

  test("does not compute cycling metrics without device watts", () => {
    const stream = sanitizeStream({
      timeS: Array.from({ length: 120 }, (_, index) => index),
      watts: Array.from({ length: 120 }, () => 220),
      moving: Array.from({ length: 120 }, () => true),
    });

    const context = {
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
        sex: "M" as const,
      },
      sportFamily: "cycling" as const,
      deviceWatts: false,
    };

    expect(cyclingModule.canCompute(context)).toBe(false);
  });
});
