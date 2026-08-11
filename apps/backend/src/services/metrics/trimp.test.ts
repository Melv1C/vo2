import { describe, expect, test } from "bun:test";

import { sanitizeStream } from "./sanitize-stream";
import { testRawStreamInput } from "./test-stream-input";
import {
  banisterSampleContribution,
  collectMovingHrSamples,
  computeBanisterTrimp,
  computeEdwardsTrimp,
  computeHrTss,
  computeUniversalMetrics,
  heartRateReserve,
} from "./trimp";

function steadyHrStream(
  durationS: number,
  hr: number,
  stepS = 1,
): ReturnType<typeof collectMovingHrSamples> {
  const stream = sanitizeStream(
    testRawStreamInput({
      timeS: Array.from({ length: durationS / stepS }, (_, index) => index * stepS),
      heartrate: Array.from({ length: durationS / stepS }, () => hr),
      moving: Array.from({ length: durationS / stepS }, () => true),
    }),
  );

  return collectMovingHrSamples(stream);
}

describe("heartRateReserve", () => {
  test("clamps below resting and above max", () => {
    expect(heartRateReserve(50, 65, 200)).toBe(0);
    expect(heartRateReserve(220, 65, 200)).toBe(1);
    expect(heartRateReserve(182, 65, 200)).toBeCloseTo((182 - 65) / (200 - 65), 5);
  });
});

describe("computeHrTss", () => {
  test("returns 100 for one hour at LTHR", () => {
    expect(computeHrTss(182, 3600, 182)).toBeCloseTo(100, 1);
  });
});

describe("banisterSampleContribution", () => {
  test("female scale factor is higher than male at same HRR", () => {
    const male = banisterSampleContribution(60, 182, 65, 200, "M");
    const female = banisterSampleContribution(60, 182, 65, 200, "F");
    expect(female).toBeGreaterThan(male);
  });
});

describe("computeBanisterTrimp", () => {
  test("returns finite TRIMP when HR samples have gaps", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: [0, 1, 2, 120, 121, 122],
        heartrate: [140, 141, 142, 150, 151, 152],
        moving: [true, true, true, true, true, true],
      }),
    );
    const samples = collectMovingHrSamples(stream);
    const trimp = computeBanisterTrimp(samples, 65, 200, "M");

    expect(trimp).not.toBeNull();
    expect(Number.isFinite(trimp)).toBe(true);
    expect(trimp!).toBeGreaterThan(0);
  });

  test("female TRIMP exceeds male for identical workload", () => {
    const samples = steadyHrStream(3600, 182);
    const male = computeBanisterTrimp(samples, 65, 200, "M")!;
    const female = computeBanisterTrimp(samples, 65, 200, "F")!;
    expect(female).toBeGreaterThan(male);
  });
});

describe("computeEdwardsTrimp", () => {
  test("weights higher zones more heavily", () => {
    const low = steadyHrStream(600, 110);
    const high = steadyHrStream(600, 185);

    const lowTrimp = computeEdwardsTrimp(low, 200)!;
    const highTrimp = computeEdwardsTrimp(high, 200)!;

    expect(highTrimp).toBeGreaterThan(lowTrimp);
  });
});

describe("computeUniversalMetrics", () => {
  test("populates universal metrics for a steady HR stream", () => {
    const stream = sanitizeStream(
      testRawStreamInput({
        timeS: Array.from({ length: 3600 }, (_, index) => index),
        heartrate: Array.from({ length: 3600 }, () => 182),
        velocityMps: Array.from({ length: 3600 }, () => 3),
        moving: Array.from({ length: 3600 }, () => true),
      }),
    );

    const result = computeUniversalMetrics({
      stream,
      athlete: {
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
        sex: "M",
      },
    });

    expect(result.trimpBanister).toBeGreaterThan(0);
    expect(result.trimpEdwards).toBeGreaterThan(0);
    expect(result.hrTss).toBeCloseTo(100, 1);
    expect(result.timeInZone.length).toBeGreaterThan(0);
    expect(result.avgHr).toBeCloseTo(182, 1);
  });
});
