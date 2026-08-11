import type {
  AthleteContext,
  CrossCheckResult,
  CyclingPayload,
  DataQualityReport,
  RunningPayload,
  SportFamily,
  SportPayload,
  SwimmingPayload,
} from "./types";

export type AnchorCrossCheck = {
  id: string;
  label: string;
  value: number | null;
  expected: string;
  pass: boolean;
};

export type AnchorCrossCheckSummary = {
  checks: AnchorCrossCheck[];
};

const DISAGREEMENT_THRESHOLD_PCT = 25;
const DECOUPLING_SANITY_THRESHOLD_PCT = 25;
const COVERAGE_THRESHOLD_PCT = 80;

function percentDifference(left: number, right: number): number {
  if (right === 0) {
    return left === 0 ? 0 : 100;
  }
  return Math.abs((left - right) / right) * 100;
}

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
 * Per-activity cross-checks between load estimators and data quality gates.
 * Disagreement percentages are stored for diagnostics; only hrTSS gates load downgrade.
 */
export function computeActivityCrossChecks(input: {
  trimpBanister: number | null;
  trimpEdwards: number | null;
  hrTss: number | null;
  decouplingPct: number | null;
  dataQuality: DataQualityReport;
  sportFamily: SportFamily;
  sportPayload: SportPayload | null;
}): CrossCheckResult {
  const banisterVsEdwardsPct =
    input.trimpBanister != null && input.trimpEdwards != null && input.trimpEdwards > 0
      ? percentDifference(input.trimpBanister, input.trimpEdwards)
      : null;

  let tssVsHrtssPct: number | null = null;
  let rtssVsHrtssPct: number | null = null;
  let stssVsHrtssPct: number | null = null;

  if (input.sportPayload && input.hrTss != null) {
    if (isCyclingPayload(input.sportPayload)) {
      tssVsHrtssPct = percentDifference(input.sportPayload.tss, input.hrTss);
    }
    if (isRunningPayload(input.sportPayload)) {
      rtssVsHrtssPct = percentDifference(input.sportPayload.rTss, input.hrTss);
    }
    if (isSwimmingPayload(input.sportPayload)) {
      stssVsHrtssPct = percentDifference(input.sportPayload.sTss, input.hrTss);
    }
  }

  return {
    tssVsHrtssPct,
    rtssVsHrtssPct,
    stssVsHrtssPct,
    banisterVsEdwardsPct,
    decouplingSanity:
      input.decouplingPct == null ||
      Math.abs(input.decouplingPct) <= DECOUPLING_SANITY_THRESHOLD_PCT,
    coverageOk: input.dataQuality.coveragePct >= COVERAGE_THRESHOLD_PCT,
    downgraded: false,
  };
}

function ageFromBirthdate(birthdate: string | null): number | null {
  if (!birthdate) {
    return null;
  }

  const born = new Date(`${birthdate}T00:00:00.000Z`);
  if (Number.isNaN(born.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }

  return age;
}

/**
 * Validates athlete anchor values against published physiological references.
 * Tanaka 2001 (HRmax), LTHR %HRmax, FTP W/kg, Uth-Sørensen VO2max, ACSM VO2 at threshold.
 */
export function computeAnchorCrossChecks(athlete: AthleteContext): AnchorCrossCheckSummary {
  const checks: AnchorCrossCheck[] = [];
  const age = ageFromBirthdate(athlete.birthdate);
  const tanaka = age != null && athlete.maxHr != null ? 208 - 0.7 * age : null;

  checks.push({
    id: "tanaka_hrmax",
    label: "HRmax vs Tanaka",
    value: athlete.maxHr,
    expected: tanaka != null ? `${tanaka.toFixed(1)} ± 12 bpm` : "birthdate + max HR required",
    pass: athlete.maxHr != null && tanaka != null ? Math.abs(athlete.maxHr - tanaka) <= 12 : false,
  });

  const lthrPct =
    athlete.lthr != null && athlete.maxHr != null && athlete.maxHr > 0
      ? (athlete.lthr / athlete.maxHr) * 100
      : null;

  checks.push({
    id: "lthr_percent_max_hr",
    label: "LTHR % of HRmax",
    value: lthrPct,
    expected: "85–92%",
    pass: lthrPct != null && lthrPct >= 85 && lthrPct <= 92,
  });

  const ftpWkg =
    athlete.ftp != null && athlete.weightKg != null && athlete.weightKg > 0
      ? athlete.ftp / athlete.weightKg
      : null;

  checks.push({
    id: "ftp_watts_per_kg",
    label: "FTP W/kg",
    value: ftpWkg,
    expected: "2.5–5.5",
    pass: ftpWkg != null && ftpWkg >= 2.5 && ftpWkg <= 5.5,
  });

  const vo2Uth =
    athlete.maxHr != null && athlete.restingHr != null && athlete.restingHr > 0
      ? (15.3 * athlete.maxHr) / athlete.restingHr
      : null;

  checks.push({
    id: "vo2max_uth_sorensen",
    label: "VO2max Uth-Sorensen",
    value: vo2Uth,
    expected: "reference estimate",
    pass: vo2Uth != null,
  });

  const vo2Cycling = ftpWkg != null ? 7 + 10.8 * ftpWkg : null;
  checks.push({
    id: "vo2_at_threshold_acsm_cycling",
    label: "VO2 at threshold (ACSM cycling)",
    value: vo2Cycling,
    expected: "reference estimate at FTP",
    pass: vo2Cycling != null,
  });

  const vo2Running =
    athlete.thresholdPaceMps != null ? 0.2 * athlete.thresholdPaceMps * 60 + 3.5 : null;

  checks.push({
    id: "vo2_at_threshold_acsm_running",
    label: "VO2 at threshold (ACSM running)",
    value: vo2Running,
    expected: "reference estimate at threshold pace",
    pass: vo2Running != null,
  });

  const vo2Swimming =
    athlete.thresholdSwimPaceMps != null ? 1.8 * athlete.thresholdSwimPaceMps * 60 + 3.5 : null;

  checks.push({
    id: "vo2_at_threshold_acsm_swimming",
    label: "VO2 at threshold (ACSM swimming)",
    value: vo2Swimming,
    expected: "reference estimate at CSS",
    pass: vo2Swimming != null,
  });

  const vo2GapPct =
    vo2Cycling != null && vo2Running != null
      ? (Math.abs(vo2Cycling - vo2Running) / ((vo2Cycling + vo2Running) / 2)) * 100
      : null;

  checks.push({
    id: "running_vs_cycling_vo2_at_threshold_gap",
    label: "Running vs cycling VO2 at threshold gap",
    value: vo2GapPct,
    expected: "< 20%",
    pass: vo2GapPct != null && vo2GapPct < 20,
  });

  return { checks };
}

export { DISAGREEMENT_THRESHOLD_PCT };
