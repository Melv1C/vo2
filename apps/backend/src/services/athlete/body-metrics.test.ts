import { describe, expect, test } from "bun:test";

import {
  computeBmi,
  computeBsa,
  resolveWeightAtDate,
  type WeightSample,
} from "./body-metrics-core";

describe("computeBmi", () => {
  test("returns BMI for typical anthropometrics", () => {
    const bmi = computeBmi(77, 180);
    expect(bmi).toBeCloseTo(23.77, 2);
  });
});

describe("computeBsa", () => {
  test("returns Du Bois body surface area", () => {
    const bsa = computeBsa(77, 180);
    expect(bsa).toBeCloseTo(1.964, 2);
  });
});

describe("resolveWeightAtDate", () => {
  const samples: WeightSample[] = [
    { value: 75, recordedAt: new Date("2024-01-01T00:00:00Z") },
    { value: 77, recordedAt: new Date("2025-06-01T00:00:00Z") },
  ];

  test("returns latest sample on or before the date", () => {
    expect(resolveWeightAtDate(samples, 80, new Date("2025-07-01T00:00:00Z"))).toBe(77);
    expect(resolveWeightAtDate(samples, 80, new Date("2024-03-01T00:00:00Z"))).toBe(75);
  });

  test("falls back to profile weight when no history matches", () => {
    expect(resolveWeightAtDate(samples, 80, new Date("2023-01-01T00:00:00Z"))).toBe(80);
  });

  test("returns null when no sample or profile weight exists", () => {
    expect(resolveWeightAtDate([], null, new Date("2025-01-01T00:00:00Z"))).toBeNull();
  });
});
