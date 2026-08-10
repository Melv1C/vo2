import type {
  AthleteSex,
  SanitizedStream,
  TimeInZone,
  UniversalComputeContext,
  UniversalMetricsResult,
} from "./types";

const BANISTER_Y = 0.64;
const BANISTER_B: Record<AthleteSex, number> = {
  M: 1.92,
  F: 1.67,
};

const EDWARDS_WEIGHTS = [1, 2, 3, 4, 5] as const;
const HR_ZONE_THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0] as const;

export type HrSample = {
  deltaS: number;
  hr: number;
  velocityMps: number | null;
};

export type { UniversalComputeContext, UniversalMetricsResult };

function banisterExponent(sex: AthleteSex | null): number {
  return BANISTER_B[sex ?? "M"];
}

export function heartRateReserve(hr: number, restingHr: number, maxHr: number): number {
  const reserve = maxHr - restingHr;
  if (reserve <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (hr - restingHr) / reserve));
}

export function banisterSampleContribution(
  deltaS: number,
  hr: number,
  restingHr: number,
  maxHr: number,
  sex: AthleteSex | null,
): number {
  const hrReserve = heartRateReserve(hr, restingHr, maxHr);
  const deltaMin = deltaS / 60;
  return deltaMin * hrReserve * BANISTER_Y * Math.exp(banisterExponent(sex) * hrReserve);
}

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

export function computeHrTss(avgHr: number, movingTimeS: number, lthr: number): number | null {
  if (lthr <= 0 || movingTimeS <= 0) {
    return null;
  }

  const durationH = movingTimeS / 3600;
  const intensity = avgHr / lthr;
  return durationH * intensity * intensity * 100;
}

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

export function computeVelocityDecoupling(samples: HrSample[]): number | null {
  const paired = samples.filter(
    (sample) => sample.velocityMps != null && sample.velocityMps > 0 && sample.hr > 0,
  );

  if (paired.length < 4) {
    return null;
  }

  const midpoint = Math.floor(paired.length / 2);
  const firstHalf = paired.slice(0, midpoint);
  const secondHalf = paired.slice(midpoint);

  const ef = (subset: HrSample[]) => {
    const ratios = subset.map((sample) => sample.velocityMps! / sample.hr);
    return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  };

  const efFirst = ef(firstHalf);
  const efSecond = ef(secondHalf);
  if (efSecond <= 0) {
    return null;
  }

  return (efFirst / efSecond - 1) * 100;
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
  const decouplingPct = computeVelocityDecoupling(samples);

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
