import { describe, expect, test } from "bun:test";

import { computeAnchorCrossChecks } from "./cross-check";
import { computeTrimpEquivalent, referenceBanisterTrimpAtLthr, resolveTrainingLoad } from "./load-resolver";
import { banisterSampleContribution } from "./trimp";

describe("referenceBanisterTrimpAtLthr", () => {
  test("matches one hour of Banister TRIMP at LTHR", () => {
    const anchor = {
      maxHr: 200,
      restingHr: 65,
      lthr: 182,
      ftp: 300,
      thresholdPaceMps: 3.26,
      weightKg: 77,
      sex: "M" as const,
    };

    let expected = 0;
    for (let second = 0; second < 3600; second++) {
      expected += banisterSampleContribution(1, 182, 65, 200, "M");
    }

    expect(referenceBanisterTrimpAtLthr(anchor)).toBeCloseTo(expected, 5);
  });
});

describe("computeTrimpEquivalent", () => {
  test("returns about 100 for one hour at LTHR", () => {
    const anchor = {
      maxHr: 200,
      restingHr: 65,
      lthr: 182,
      ftp: 300,
      thresholdPaceMps: 3.26,
      weightKg: 77,
      sex: "M" as const,
    };

    const reference = referenceBanisterTrimpAtLthr(anchor)!;
    expect(computeTrimpEquivalent(reference, anchor)).toBeCloseTo(100, 1);
  });
});

describe("resolveTrainingLoad", () => {
  const crossChecks = {
    tssVsHrtssPct: null,
    rtssVsHrtssPct: null,
    banisterVsEdwardsPct: null,
    decouplingSanity: true,
    coverageOk: true,
    downgraded: false,
  };

  const anchor = {
    maxHr: 200,
    restingHr: 65,
    lthr: 182,
    ftp: 300,
    thresholdPaceMps: 3.26,
    weightKg: 77,
    sex: "M" as const,
  };

  test("downgrades cycling TSS when hrTSS disagrees by more than 25%", () => {
    const result = resolveTrainingLoad({
      sportFamily: "cycling",
      deviceWatts: true,
      trimpBanister: 80,
      hrTss: 50,
      sportPayload: {
        np: 250,
        intensityFactor: 0.83,
        tss: 100,
        variabilityIndex: 1,
        workKj: 900,
        wattsPerKg: 3.2,
      },
      anchorSnapshot: anchor,
      crossChecks,
    });

    expect(result.loadSource).toBe("hr_tss");
    expect(result.trainingLoad).toBe(50);
    expect(result.crossChecks.downgraded).toBe(true);
  });

  test("uses rTSS for running when cross-check passes", () => {
    const result = resolveTrainingLoad({
      sportFamily: "running",
      deviceWatts: false,
      trimpBanister: 90,
      hrTss: 95,
      sportPayload: {
        ngpMps: 3.2,
        runIntensityFactor: 0.98,
        rTss: 96,
        efficiencyIndex: 0.02,
        avgCadence: 170,
      },
      anchorSnapshot: anchor,
      crossChecks,
    });

    expect(result.loadSource).toBe("r_tss");
    expect(result.trainingLoad).toBe(96);
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
      weightKg: 77,
      heightCm: 180,
      birthdate: "2004-08-10",
      sex: "M",
    });

    const tanaka = summary.checks.find((check) => check.id === "tanaka_hrmax");
    expect(tanaka?.pass).toBe(true);
  });
});
