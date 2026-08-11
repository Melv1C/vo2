import { DISAGREEMENT_THRESHOLD_PCT } from "./cross-check";
import { banisterSampleContribution } from "./trimp";
import type {
  AnchorSnapshot,
  CrossCheckResult,
  CyclingPayload,
  LoadSource,
  RunningPayload,
  SportFamily,
  SportPayload,
  SwimmingPayload,
} from "./types";

export type LoadResolverInput = {
  sportFamily: SportFamily;
  deviceWatts: boolean;
  trimpBanister: number | null;
  hrTss: number | null;
  sportPayload: SportPayload | null;
  anchorSnapshot: AnchorSnapshot;
  crossChecks: CrossCheckResult;
};

export type LoadResolverResult = {
  trainingLoad: number | null;
  loadSource: LoadSource | null;
  crossChecks: CrossCheckResult;
};

function isCyclingPayload(payload: SportPayload): payload is CyclingPayload {
  return "tss" in payload;
}

function isRunningPayload(payload: SportPayload): payload is RunningPayload {
  return "rTss" in payload;
}

function isSwimmingPayload(payload: SportPayload): payload is SwimmingPayload {
  return "sTss" in payload;
}

/**
 * Banister TRIMP for one hour at LTHR — used to normalize TRIMP to a TSS-like scale.
 * One hour at LTHR yields a reference value; activity TRIMP / reference × 100 ≈ TRIMP-equivalent load.
 */
export function referenceBanisterTrimpAtLthr(anchor: AnchorSnapshot): number | null {
  const { lthr, restingHr, maxHr, sex } = anchor;
  if (lthr == null || restingHr == null || maxHr == null) {
    return null;
  }

  return 3600 * banisterSampleContribution(1, lthr, restingHr, maxHr, sex);
}

/**
 * Scales Banister TRIMP to a TSS-like 0–100+ scale.
 * TRIMP-equivalent = (activity TRIMP / 1 h at LTHR TRIMP) × 100.
 */
export function computeTrimpEquivalent(
  trimpBanister: number | null,
  anchor: AnchorSnapshot,
): number | null {
  if (trimpBanister == null) {
    return null;
  }

  const reference = referenceBanisterTrimpAtLthr(anchor);
  if (reference == null || reference <= 0) {
    return null;
  }

  return (trimpBanister / reference) * 100;
}

function percentDifference(left: number, right: number): number {
  if (right === 0) {
    return left === 0 ? 0 : 100;
  }
  return Math.abs((left - right) / right) * 100;
}

function crossCheckPassesForLoad(preferredLoad: number, hrTss: number | null): boolean {
  if (hrTss == null || hrTss <= 0) {
    return true;
  }

  return percentDifference(preferredLoad, hrTss) <= DISAGREEMENT_THRESHOLD_PCT;
}

/**
 * Selects the best training load source for an activity.
 * Priority: TSS/rTSS (when cross-check passes) → hrTSS → TRIMP-equivalent.
 * Downgrades to hrTSS when sport-specific load disagrees with hrTSS by >25%.
 */
export function resolveTrainingLoad(input: LoadResolverInput): LoadResolverResult {
  const { sportPayload, hrTss, trimpBanister, anchorSnapshot, crossChecks } = input;

  const trimpEquivalent = computeTrimpEquivalent(trimpBanister, anchorSnapshot);

  if (
    input.sportFamily === "cycling" &&
    input.deviceWatts &&
    sportPayload &&
    isCyclingPayload(sportPayload)
  ) {
    const tss = sportPayload.tss;
    if (crossCheckPassesForLoad(tss, hrTss)) {
      return {
        trainingLoad: tss,
        loadSource: "tss",
        crossChecks,
      };
    }

    if (hrTss != null) {
      return {
        trainingLoad: hrTss,
        loadSource: "hr_tss",
        crossChecks: { ...crossChecks, downgraded: true },
      };
    }
  }

  if (input.sportFamily === "running" && sportPayload && isRunningPayload(sportPayload)) {
    const rTss = sportPayload.rTss;
    if (crossCheckPassesForLoad(rTss, hrTss)) {
      return {
        trainingLoad: rTss,
        loadSource: "r_tss",
        crossChecks,
      };
    }

    if (hrTss != null) {
      return {
        trainingLoad: hrTss,
        loadSource: "hr_tss",
        crossChecks: { ...crossChecks, downgraded: true },
      };
    }
  }

  if (input.sportFamily === "swimming" && sportPayload && isSwimmingPayload(sportPayload)) {
    const sTss = sportPayload.sTss;
    if (crossCheckPassesForLoad(sTss, hrTss)) {
      return {
        trainingLoad: sTss,
        loadSource: "s_tss",
        crossChecks,
      };
    }

    if (hrTss != null) {
      return {
        trainingLoad: hrTss,
        loadSource: "hr_tss",
        crossChecks: { ...crossChecks, downgraded: true },
      };
    }
  }

  if (hrTss != null) {
    return {
      trainingLoad: hrTss,
      loadSource: "hr_tss",
      crossChecks,
    };
  }

  if (trimpEquivalent != null) {
    return {
      trainingLoad: trimpEquivalent,
      loadSource: "trimp_equiv",
      crossChecks,
    };
  }

  return {
    trainingLoad: null,
    loadSource: null,
    crossChecks,
  };
}
