import { describe, expect, test } from "bun:test";

import { cyclingModule, computeCyclingMetrics } from "./power";
import { sanitizeStream } from "./sanitize-stream";
import { testRawStreamInput } from "./test-stream-input";

const athlete = {
  userId: "user-1",
  maxHr: 200,
  restingHr: 65,
  lthr: 182,
  ftp: 300,
  thresholdPaceMps: 3.26,
  thresholdSwimPaceMps: null,
  weightKg: 77,
  heightCm: 180,
  birthdate: "2004-08-10",
  sex: "M" as const,
};

describe("computeCyclingMetrics", () => {
  test("computes NP and TSS for a steady power-meter ride", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 3600 }, (_, index) => index),
        watts: Array.from({ length: 3600 }, () => 250),
        heartrate: Array.from({ length: 3600 }, () => 150),
        moving: Array.from({ length: 3600 }, () => true),
      }),
    );

    const result = computeCyclingMetrics({
      stream,
      athlete,
      sportFamily: "cycling",
      deviceWatts: true,
    });

    expect(result.sportPayload && "tss" in result.sportPayload).toBe(true);
    if (result.sportPayload && "tss" in result.sportPayload) {
      expect(result.sportPayload.np).toBeCloseTo(250, 0);
      expect(result.sportPayload.intensityFactor).toBeCloseTo(250 / 300, 2);
      expect(result.sportPayload.tss).toBeCloseTo(69.4, 0);
    }
    expect(result.energyKcal).toBeGreaterThan(0);
  });

  test("energyKcal approximates mechanical work in kJ", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 3600 }, (_, index) => index),
        watts: Array.from({ length: 3600 }, () => 250),
        moving: Array.from({ length: 3600 }, () => true),
      }),
    );

    const result = computeCyclingMetrics({
      stream,
      athlete,
      sportFamily: "cycling",
      deviceWatts: true,
    });

    expect(result.energyKcal).toBeCloseTo(900, 0);
  });

  test("includes zero-watt coasting samples and lowers NP below steady power", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 3600 }, (_, index) => index),
        watts: Array.from({ length: 3600 }, (_, index) => (index < 1800 ? 250 : 0)),
        heartrate: Array.from({ length: 3600 }, () => 150),
        moving: Array.from({ length: 3600 }, () => true),
      }),
    );

    const steady = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 3600 }, (_, index) => index),
        watts: Array.from({ length: 3600 }, () => 250),
        heartrate: Array.from({ length: 3600 }, () => 150),
        moving: Array.from({ length: 3600 }, () => true),
      }),
    );

    const withCoasting = computeCyclingMetrics({
      stream,
      athlete,
      sportFamily: "cycling",
      deviceWatts: true,
    });
    const withoutCoasting = computeCyclingMetrics({
      stream: steady,
      athlete,
      sportFamily: "cycling",
      deviceWatts: true,
    });

    const coastingNp =
      withCoasting.sportPayload && "tss" in withCoasting.sportPayload
        ? withCoasting.sportPayload.np
        : null;
    const steadyNp =
      withoutCoasting.sportPayload && "tss" in withoutCoasting.sportPayload
        ? withoutCoasting.sportPayload.np
        : null;

    expect(coastingNp).toBeLessThan(steadyNp ?? 0);
    expect(coastingNp).toBeLessThan(250);
  });

  test("does not compute cycling metrics without device watts", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 120 }, (_, index) => index),
        watts: Array.from({ length: 120 }, () => 220),
        moving: Array.from({ length: 120 }, () => true),
      }),
    );

    const context = {
      stream,
      athlete,
      sportFamily: "cycling" as const,
      deviceWatts: false,
    };

    expect(cyclingModule.canCompute(context)).toBe(false);
  });
});
