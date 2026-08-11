import { describe, expect, test } from "bun:test";

import { sanitizeStream } from "./sanitize-stream";
import { computeSwimmingMetrics, swimmingModule } from "./swim";
import { testRawStreamInput } from "./test-stream-input";

const athlete = {
  userId: "user-1",
  maxHr: 190,
  restingHr: 60,
  lthr: 170,
  ftp: 250,
  thresholdPaceMps: 3.26,
  thresholdSwimPaceMps: 1.2,
  weightKg: 75,
  heightCm: 180,
  birthdate: "1990-01-01",
  sex: "M" as const,
};

describe("computeSwimmingMetrics", () => {
  test("computes NSP and sTSS for a steady swim at CSS", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 3600 }, (_, index) => index),
        velocityMps: Array.from({ length: 3600 }, () => 1.2),
        heartrate: Array.from({ length: 3600 }, () => 145),
        cadence: Array.from({ length: 3600 }, () => 28),
        moving: Array.from({ length: 3600 }, () => true),
      }),
    );

    const result = computeSwimmingMetrics({
      stream,
      athlete,
      sportFamily: "swimming",
      deviceWatts: false,
    });

    expect(result.sportPayload && "sTss" in result.sportPayload).toBe(true);
    if (result.sportPayload && "sTss" in result.sportPayload) {
      expect(result.sportPayload.nspMps).toBeCloseTo(1.2, 1);
      expect(result.sportPayload.swimIntensityFactor).toBeCloseTo(1, 1);
      expect(result.sportPayload.sTss).toBeCloseTo(100, 1);
    }
    expect(result.energyKcal).toBeGreaterThan(0);
  });

  test("does not compute without CSS anchor", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 120 }, (_, index) => index),
        velocityMps: Array.from({ length: 120 }, () => 1.1),
        moving: Array.from({ length: 120 }, () => true),
      }),
    );

    expect(
      swimmingModule.canCompute({
        stream,
        athlete: { ...athlete, thresholdSwimPaceMps: null },
        sportFamily: "swimming",
        deviceWatts: false,
      }),
    ).toBe(false);
  });
});
