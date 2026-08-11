import { describe, expect, test } from "bun:test";

import { normalizedFourthPowerMean, splitEfficiencyDecoupling } from "./coggan-rolling";

describe("normalizedFourthPowerMean", () => {
  test("returns steady value for constant power", () => {
    const samples = Array.from({ length: 120 }, (_, index) => ({
      timeS: index,
      deltaS: 1,
      value: 200,
    }));

    expect(normalizedFourthPowerMean(samples)).toBeCloseTo(200, 1);
  });

  test("returns lower NP when zero-power coasting is included", () => {
    const steady = Array.from({ length: 60 }, (_, index) => ({
      timeS: index,
      deltaS: 1,
      value: 250,
    }));
    const withZeros = [
      ...Array.from({ length: 30 }, (_, index) => ({
        timeS: index,
        deltaS: 1,
        value: 250,
      })),
      ...Array.from({ length: 30 }, (_, index) => ({
        timeS: index + 30,
        deltaS: 1,
        value: 0,
      })),
    ];

    const steadyNp = normalizedFourthPowerMean(steady)!;
    const mixedNp = normalizedFourthPowerMean(withZeros)!;

    expect(mixedNp).toBeLessThan(steadyNp);
    expect(mixedNp).toBeLessThan(250);
  });
});

describe("splitEfficiencyDecoupling", () => {
  test("returns null with fewer than 4 samples", () => {
    expect(splitEfficiencyDecoupling([{ efficiency: 1 }])).toBeNull();
  });

  test("detects efficiency drop in second half", () => {
    const samples = [
      ...Array.from({ length: 10 }, () => ({ efficiency: 2 })),
      ...Array.from({ length: 10 }, () => ({ efficiency: 1 })),
    ];

    expect(splitEfficiencyDecoupling(samples)).toBeCloseTo(100, 0);
  });
});
