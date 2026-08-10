import { describe, expect, test } from "bun:test";

import { sanitizeStream } from "./sanitize-stream";
import { resolveSportFamily } from "./sport-family";

function series(length: number, stepS: number): number[] {
  return Array.from({ length }, (_, i) => i * stepS);
}

describe("sanitizeStream", () => {
  test("1 Hz continuous stream keeps high coverage", () => {
    const n = 3600;
    const result = sanitizeStream({
      timeS: series(n, 1),
      heartrate: Array.from({ length: n }, () => 140),
      moving: Array.from({ length: n }, () => true),
      distanceM: null,
      altitudeM: null,
      velocityMps: null,
      cadence: null,
      watts: null,
      gradePct: null,
    });

    expect(result.segments).toHaveLength(1);
    expect(result.quality.nominalDtS).toBe(1);
    expect(result.quality.coveragePct).toBeGreaterThan(99);
    expect(result.quality.movingTimeS).toBeCloseTo(3599, 0);
  });

  test("4 s smart-recording weights deltas correctly", () => {
    const n = 100;
    const result = sanitizeStream({
      timeS: series(n, 4),
      heartrate: Array.from({ length: n }, () => 150),
      moving: Array.from({ length: n }, () => true),
      distanceM: null,
      altitudeM: null,
      velocityMps: null,
      cadence: null,
      watts: null,
      gradePct: null,
    });

    expect(result.quality.nominalDtS).toBe(4);
    expect(result.quality.movingTimeS).toBeCloseTo((n - 1) * 4, 0);
  });

  test("long pause splits into segments without inflating moving time", () => {
    const before = series(60, 1);
    const after = Array.from({ length: 60 }, (_, i) => 5400 + i);
    const timeS = [...before, ...after];
    const n = timeS.length;

    const result = sanitizeStream({
      timeS,
      heartrate: Array.from({ length: n }, () => 140),
      moving: Array.from({ length: n }, () => true),
      distanceM: null,
      altitudeM: null,
      velocityMps: null,
      cadence: null,
      watts: null,
      gradePct: null,
    });

    expect(result.segments.length).toBeGreaterThanOrEqual(2);
    expect(result.quality.longestGapS).toBeGreaterThan(60);
    expect(result.quality.movingTimeS).toBeLessThan(200);
  });

  test("zero HR samples are dropped", () => {
    const n = 10;
    const hr = Array.from({ length: n }, () => 140);
    hr[5] = 0;

    const result = sanitizeStream({
      timeS: series(n, 1),
      heartrate: hr,
      moving: Array.from({ length: n }, () => true),
      distanceM: null,
      altitudeM: null,
      velocityMps: null,
      cadence: null,
      watts: null,
      gradePct: null,
    });

    expect(result.quality.samplesDropped).toBeGreaterThanOrEqual(1);
  });

  test("impossible HR spike is dropped", () => {
    const n = 5;
    const hr = [120, 121, 200, 122, 123];

    const result = sanitizeStream({
      timeS: series(n, 1),
      heartrate: hr,
      moving: Array.from({ length: n }, () => true),
      distanceM: null,
      altitudeM: null,
      velocityMps: null,
      cadence: null,
      watts: null,
      gradePct: null,
    });

    expect(result.quality.samplesDropped).toBeGreaterThanOrEqual(1);
  });

  test("single-sample activity returns one segment", () => {
    const result = sanitizeStream({
      timeS: [0],
      heartrate: [130],
      moving: [true],
      distanceM: null,
      altitudeM: null,
      velocityMps: null,
      cadence: null,
      watts: null,
      gradePct: null,
    });

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.samples).toHaveLength(1);
  });

  test("empty input returns empty segments", () => {
    const result = sanitizeStream({
      timeS: null,
      distanceM: null,
      altitudeM: null,
      velocityMps: null,
      heartrate: null,
      cadence: null,
      watts: null,
      moving: null,
      gradePct: null,
    });

    expect(result.segments).toHaveLength(0);
    expect(result.quality.samplesIn).toBe(0);
  });
});

describe("resolveSportFamily", () => {
  test("maps cycling types", () => {
    expect(resolveSportFamily("Ride")).toBe("cycling");
    expect(resolveSportFamily("VirtualRide")).toBe("cycling");
  });

  test("maps running types", () => {
    expect(resolveSportFamily("Run")).toBe("running");
    expect(resolveSportFamily("TrailRun")).toBe("running");
  });

  test("maps walking types", () => {
    expect(resolveSportFamily("Walk")).toBe("walking");
  });

  test("unknown maps to other", () => {
    expect(resolveSportFamily("Swim")).toBe("other");
    expect(resolveSportFamily(null)).toBe("other");
  });
});
