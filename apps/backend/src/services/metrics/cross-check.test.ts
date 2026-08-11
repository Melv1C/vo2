import { describe, expect, test } from "bun:test";

import { computeActivityCrossChecks, computeAnchorCrossChecks } from "./cross-check";

describe("computeActivityCrossChecks", () => {
  test("computes TSS vs hrTSS disagreement for cycling", () => {
    const result = computeActivityCrossChecks({
      trimpBanister: 80,
      trimpEdwards: 90,
      hrTss: 50,
      decouplingPct: 5,
      dataQuality: {
        samplesIn: 100,
        samplesDropped: 0,
        segments: 1,
        longestGapS: 0,
        nominalDtS: 1,
        coveragePct: 100,
        movingTimeS: 3600,
      },
      sportFamily: "cycling",
      sportPayload: {
        np: 250,
        intensityFactor: 0.83,
        tss: 100,
        variabilityIndex: 1,
        workKj: 900,
        wattsPerKg: 3.2,
      },
    });

    expect(result.tssVsHrtssPct).toBeCloseTo(100, 0);
    expect(result.coverageOk).toBe(true);
    expect(result.decouplingSanity).toBe(true);
    expect(result.downgraded).toBe(false);
  });

  test("computes sTSS vs hrTSS disagreement for swimming", () => {
    const result = computeActivityCrossChecks({
      trimpBanister: 80,
      trimpEdwards: 90,
      hrTss: 50,
      decouplingPct: 5,
      dataQuality: {
        samplesIn: 100,
        samplesDropped: 0,
        segments: 1,
        longestGapS: 0,
        nominalDtS: 1,
        coveragePct: 100,
        movingTimeS: 3600,
      },
      sportFamily: "swimming",
      sportPayload: {
        nspMps: 1.2,
        swimIntensityFactor: 1,
        sTss: 100,
        efficiencyIndex: 0.008,
        avgCadence: 28,
      },
    });

    expect(result.stssVsHrtssPct).toBeCloseTo(100, 0);
  });

  test("flags decoupling above sanity threshold", () => {
    const result = computeActivityCrossChecks({
      trimpBanister: null,
      trimpEdwards: null,
      hrTss: null,
      decouplingPct: 30,
      dataQuality: {
        samplesIn: 100,
        samplesDropped: 20,
        segments: 1,
        longestGapS: 0,
        nominalDtS: 1,
        coveragePct: 70,
        movingTimeS: 3600,
      },
      sportFamily: "running",
      sportPayload: null,
    });

    expect(result.decouplingSanity).toBe(false);
    expect(result.coverageOk).toBe(false);
  });
});

describe("computeAnchorCrossChecks", () => {
  test("passes Tanaka check for seeded anchors", () => {
    const summary = computeAnchorCrossChecks({
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
    });

    const tanaka = summary.checks.find((check) => check.id === "tanaka_hrmax");
    expect(tanaka?.pass).toBe(true);
  });

  test("labels ACSM checks as VO2 at threshold", () => {
    const summary = computeAnchorCrossChecks({
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
    });

    expect(summary.checks.some((check) => check.id === "vo2_at_threshold_acsm_cycling")).toBe(true);
    expect(summary.checks.some((check) => check.id === "vo2_at_threshold_acsm_running")).toBe(true);
    expect(summary.checks.some((check) => check.id === "vo2max_acsm_cycling")).toBe(false);
  });

  test("fails LTHR percent check outside 85-92% range", () => {
    const summary = computeAnchorCrossChecks({
      userId: "user-1",
      maxHr: 200,
      restingHr: 65,
      lthr: 150,
      ftp: 300,
      thresholdPaceMps: 3.26,
      thresholdSwimPaceMps: null,
      weightKg: 77,
      heightCm: 180,
      birthdate: "2004-08-10",
      sex: "M",
    });

    const lthrCheck = summary.checks.find((check) => check.id === "lthr_percent_max_hr");
    expect(lthrCheck?.pass).toBe(false);
  });
});
