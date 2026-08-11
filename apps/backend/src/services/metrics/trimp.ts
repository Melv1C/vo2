import { splitEfficiencyDecoupling } from "./coggan-rolling";
import type {
  AthleteSex,
  SanitizedStream,
  TimeInZone,
  UniversalComputeContext,
  UniversalMetricsResult,
} from "./types";

/** Banister TRIMP scale factor A (sex-specific). Source: Banister & Hamilton 1991. */
const BANISTER_A: Record<AthleteSex, number> = {
  M: 0.64,
  F: 0.86,
};

/** Banister TRIMP exponent B (sex-specific). Source: Banister & Hamilton 1991. */
const BANISTER_B: Record<AthleteSex, number> = {
  M: 1.92,
  F: 1.67,
};

/** Edwards zone weights (zones 1–5). Source: Edwards 1993. */
const EDWARDS_WEIGHTS = [1, 2, 3, 4, 5] as const;

/** HR zone upper bounds as fraction of HRmax (zones 1–5). */
const HR_ZONE_THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

export type HrSample = {
  /** Sample duration in seconds. */
  deltaS: number;
  /** Heart rate in bpm. */
  hr: number;
  /** Ground speed in m/s, when available. */
  velocityMps: number | null;
};

export type { UniversalComputeContext, UniversalMetricsResult };

/**
 * Heart-rate reserve as a fraction of max reserve (0–1).
 * HRR = (HR − HRrest) / (HRmax − HRrest), clamped to [0, 1].
 *
 * @param hr - Current heart rate (bpm)
 * @param restingHr - Resting heart rate (bpm)
 * @param maxHr - Maximum heart rate (bpm)
 * @returns Fractional reserve, or 0 when max ≤ resting
 */
export function heartRateReserve(hr: number, restingHr: number, maxHr: number): number {
  const reserve = maxHr - restingHr;
  if (reserve <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (hr - restingHr) / reserve));
}

/**
 * Banister TRIMP contribution for one sample.
 * TRIMP = Δt(min) × HRR × A × e^(B × HRR).
 * Male: A=0.64, B=1.92; Female: A=0.86, B=1.67.
 *
 * @param deltaS - Sample duration (seconds)
 * @param hr - Heart rate (bpm)
 * @param restingHr - Resting heart rate (bpm)
 * @param maxHr - Maximum heart rate (bpm)
 * @param sex - Athlete sex; defaults to male when null
 * @returns TRIMP contribution (arbitrary units)
 */
export function banisterSampleContribution(
  deltaS: number,
  hr: number,
  restingHr: number,
  maxHr: number,
  sex: AthleteSex | null,
): number {
  const hrReserve = heartRateReserve(hr, restingHr, maxHr);
  const deltaMin = deltaS / 60;
  const athleteSex = sex ?? "M";
  return (
    deltaMin * hrReserve * BANISTER_A[athleteSex] * Math.exp(BANISTER_B[athleteSex] * hrReserve)
  );
}

/**
 * Collects moving HR samples from a sanitized stream for TRIMP/TSS computation.
 *
 * @param stream - Gap-segmented sanitized stream
 * @returns HR samples with duration and optional velocity
 */
export function collectMovingHrSamples(stream: SanitizedStream): HrSample[] {
  const samples: HrSample[] = [];

  for (const segment of stream.segments) {
    for (const sample of segment.samples) {
      if (!sample.moving || sample.deltaS <= 0 || sample.hr == null) {
        continue;
      }
      samples.push({
        deltaS: sample.deltaS,
        hr: sample.hr,
        velocityMps: sample.velocityMps,
      });
    }
  }

  return samples;
}

function hrZoneIndex(hr: number, maxHr: number): number | null {
  if (maxHr <= 0) {
    return null;
  }

  const pct = hr / maxHr;
  if (pct < HR_ZONE_THRESHOLDS[0]) {
    return null;
  }

  for (let index = 0; index < EDWARDS_WEIGHTS.length; index++) {
    const upper = HR_ZONE_THRESHOLDS[index + 1]!;
    if (pct < upper || index === EDWARDS_WEIGHTS.length - 1) {
      return index + 1;
    }
  }

  return EDWARDS_WEIGHTS.length;
}

/**
 * Banister TRIMP total for a set of HR samples.
 * Returns null when no samples or missing HR anchors.
 *
 * @param samples - Moving HR samples
 * @param restingHr - Resting heart rate (bpm)
 * @param maxHr - Maximum heart rate (bpm)
 * @param sex - Athlete sex
 */
export function computeBanisterTrimp(
  samples: HrSample[],
  restingHr: number,
  maxHr: number,
  sex: AthleteSex | null,
): number | null {
  if (samples.length === 0 || restingHr == null || maxHr == null) {
    return null;
  }

  let total = 0;
  for (const sample of samples) {
    total += banisterSampleContribution(sample.deltaS, sample.hr, restingHr, maxHr, sex);
  }

  return total;
}

/**
 * Edwards zone-weighted TRIMP.
 * Each minute in zone Z contributes weight Z (1–5) to the total.
 * Source: Edwards 1993.
 *
 * @returns null when no samples or maxHr ≤ 0
 */
export function computeEdwardsTrimp(samples: HrSample[], maxHr: number): number | null {
  if (samples.length === 0 || maxHr <= 0) {
    return null;
  }

  let total = 0;
  for (const sample of samples) {
    const zone = hrZoneIndex(sample.hr, maxHr);
    if (zone == null) {
      continue;
    }
    total += (sample.deltaS / 60) * EDWARDS_WEIGHTS[zone - 1]!;
  }

  return total;
}

/**
 * Heart-rate TSS from session average HR.
 * hrTSS = duration(h) × (avgHR / LTHR)² × 100.
 * One hour at LTHR yields 100.
 *
 * @param avgHr - Session average heart rate (bpm)
 * @param movingTimeS - Moving duration (seconds)
 * @param lthr - Lactate threshold heart rate (bpm)
 */
export function computeHrTss(avgHr: number, movingTimeS: number, lthr: number): number | null {
  if (lthr <= 0 || movingTimeS <= 0) {
    return null;
  }

  const durationH = movingTimeS / 3600;
  const intensity = avgHr / lthr;
  return durationH * intensity * intensity * 100;
}

/**
 * Time spent in each HR zone (Edwards zones 1–5, % of HRmax).
 *
 * @returns Sorted list of { zone, seconds }
 */
export function computeHrTimeInZone(samples: HrSample[], maxHr: number): TimeInZone[] {
  const secondsByZone = new Map<number, number>();

  for (const sample of samples) {
    const zone = hrZoneIndex(sample.hr, maxHr);
    if (zone == null) {
      continue;
    }
    secondsByZone.set(zone, (secondsByZone.get(zone) ?? 0) + sample.deltaS);
  }

  return [...secondsByZone.entries()]
    .sort(([left], [right]) => left - right)
    .map(([zone, seconds]) => ({ zone, seconds }));
}

function summarizeHr(samples: HrSample[]): { avgHr: number | null; maxHr: number | null } {
  if (samples.length === 0) {
    return { avgHr: null, maxHr: null };
  }

  let weightedSum = 0;
  let totalSeconds = 0;
  let maxHr = 0;

  for (const sample of samples) {
    weightedSum += sample.hr * sample.deltaS;
    totalSeconds += sample.deltaS;
    maxHr = Math.max(maxHr, sample.hr);
  }

  return {
    avgHr: totalSeconds > 0 ? weightedSum / totalSeconds : null,
    maxHr: maxHr > 0 ? maxHr : null,
  };
}

/**
 * Universal (sport-agnostic) metrics from HR stream data.
 * Computes Banister/Edwards TRIMP, hrTSS, time-in-zone, and aerobic decoupling.
 */
export function computeUniversalMetrics(ctx: UniversalComputeContext): UniversalMetricsResult {
  const samples = collectMovingHrSamples(ctx.stream);
  const movingTimeS = ctx.stream.quality.movingTimeS;
  const { restingHr, maxHr, lthr, sex } = ctx.athlete;
  const { avgHr, maxHr: sampleMaxHr } = summarizeHr(samples);

  const trimpBanister =
    restingHr != null && maxHr != null
      ? computeBanisterTrimp(samples, restingHr, maxHr, sex)
      : null;
  const trimpEdwards = maxHr != null ? computeEdwardsTrimp(samples, maxHr) : null;
  const hrTss = avgHr != null && lthr != null ? computeHrTss(avgHr, movingTimeS, lthr) : null;
  const timeInZone = maxHr != null ? computeHrTimeInZone(samples, maxHr) : [];

  const efficiencySamples = samples
    .filter((sample) => sample.velocityMps != null && sample.velocityMps > 0 && sample.hr > 0)
    .map((sample) => ({ efficiency: sample.velocityMps! / sample.hr }));
  const decouplingPct = splitEfficiencyDecoupling(efficiencySamples);

  return {
    trimpBanister,
    trimpEdwards,
    hrTss,
    avgHr,
    maxHr: sampleMaxHr,
    movingTimeS,
    decouplingPct,
    timeInZone,
  };
}

export const universalModule = {
  compute: computeUniversalMetrics,
};
