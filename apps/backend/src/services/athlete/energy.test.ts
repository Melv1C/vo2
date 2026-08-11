import { describe, expect, test } from "bun:test";

import {
  acsmRunningEnergyKcal,
  acsmSwimmingEnergyKcal,
  cyclingEnergyKcalFromWorkKj,
} from "./energy";

describe("cyclingEnergyKcalFromWorkKj", () => {
  test("returns work in kJ as kcal (1:1 convention)", () => {
    expect(cyclingEnergyKcalFromWorkKj(900)).toBe(900);
  });
});

describe("acsmRunningEnergyKcal", () => {
  test("returns positive energy for steady pace", () => {
    expect(acsmRunningEnergyKcal(3, 75, 3600)).toBeGreaterThan(0);
  });
});

describe("acsmSwimmingEnergyKcal", () => {
  test("returns higher energy than running at same speed", () => {
    const running = acsmRunningEnergyKcal(1.2, 75, 3600);
    const swimming = acsmSwimmingEnergyKcal(1.2, 75, 3600);
    expect(swimming).toBeGreaterThan(running);
  });
});
