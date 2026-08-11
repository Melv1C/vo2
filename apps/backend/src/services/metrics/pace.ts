import { acsmRunningEnergyKcal } from "@/services/athlete/energy";

import {
  normalizedFourthPowerMean,
  splitEfficiencyDecoupling,
  type TimedValue,
} from "./coggan-rolling";
import type {
  RunningPayload,
  SanitizedSample,
  SportComputeContext,
  SportModuleResult,
} from "./types";

const MIN_GAP_SAMPLES = 30;
const MAX_GRADE = 0.45;

/**
 * Minetti metabolic cost polynomial for grade (dimensionless).
 * Source: Minetti et al. 2002, J Appl Physiol.
 *
 * @param gradient - Grade as rise/run (e.g. 0.05 = 5%)
 */
export function minettiCost(gradient: number): number {
  const grade = Math.max(-MAX_GRADE, Math.min(MAX_GRADE, gradient));
  return (
    155.4 * grade ** 5 -
    30.4 * grade ** 4 -
    43.3 * grade ** 3 +
    46.3 * grade ** 2 +
    19.5 * grade +
    3.6
  );
}

/**
 * Grade-adjusted pace (GAP) in m/s.
 * Scales velocity by relative Minetti cost at grade vs flat.
 */
export function gradeAdjustedSpeed(velocityMps: number, gradient: number): number {
  const flatCost = minettiCost(0);
  const gradeCost = minettiCost(gradient);
  if (flatCost <= 0) {
    return velocityMps;
  }
  return (velocityMps * gradeCost) / flatCost;
}

type RunningSample = {
  timeS: number;
  deltaS: number;
  velocityMps: number;
  gapMps: number;
  hr: number | null;
  cadence: number | null;
};

function resolveGradient(
  current: SanitizedSample,
  previous: SanitizedSample | null,
): number | null {
  if (current.gradePct != null) {
    return current.gradePct / 100;
  }

  if (
    previous == null ||
    current.distanceM == null ||
    previous.distanceM == null ||
    current.altitudeM == null ||
    previous.altitudeM == null
  ) {
    return 0;
  }

  const deltaDistance = current.distanceM - previous.distanceM;
  if (deltaDistance <= 0) {
    return null;
  }

  return (current.altitudeM - previous.altitudeM) / deltaDistance;
}

function collectRunningSamples(stream: SportComputeContext["stream"]): RunningSample[] {
  const samples: RunningSample[] = [];

  for (const segment of stream.segments) {
    let previous: SanitizedSample | null = null;

    for (const sample of segment.samples) {
      if (
        !sample.moving ||
        sample.deltaS <= 0 ||
        sample.velocityMps == null ||
        sample.velocityMps <= 0
      ) {
        previous = sample;
        continue;
      }

      const gradient = resolveGradient(sample, previous) ?? 0;
      samples.push({
        timeS: sample.timeS,
        deltaS: sample.deltaS,
        velocityMps: sample.velocityMps,
        gapMps: gradeAdjustedSpeed(sample.velocityMps, gradient),
        hr: sample.hr,
        cadence: sample.cadence,
      });
      previous = sample;
    }
  }

  return samples;
}

function averageHr(samples: RunningSample[]): number | null {
  const paired = samples.filter((sample) => sample.hr != null && sample.hr > 0);
  if (paired.length === 0) {
    return null;
  }

  let weightedSum = 0;
  let durationS = 0;
  for (const sample of paired) {
    weightedSum += sample.hr! * sample.deltaS;
    durationS += sample.deltaS;
  }

  return durationS > 0 ? weightedSum / durationS : null;
}

function averageCadence(samples: RunningSample[]): number | null {
  const paired = samples.filter((sample) => sample.cadence != null && sample.cadence > 0);
  if (paired.length === 0) {
    return null;
  }

  let weightedSum = 0;
  let durationS = 0;
  for (const sample of paired) {
    weightedSum += sample.cadence! * sample.deltaS;
    durationS += sample.deltaS;
  }

  return durationS > 0 ? weightedSum / durationS : null;
}

/**
 * Running metrics from velocity stream data.
 * Computes NGP (Minetti grade adjustment + Coggan fourth-power mean),
 * rTSS, efficiency index, and ACSM energy estimate.
 */
export function computeRunningMetrics(
  ctx: SportComputeContext,
): Pick<SportModuleResult, "sportPayload" | "energyKcal" | "decouplingPct"> {
  const thresholdPaceMps = ctx.athlete.thresholdPaceMps;
  const weightKg = ctx.athlete.weightKg;
  const runningSamples = collectRunningSamples(ctx.stream);

  if (
    runningSamples.length < MIN_GAP_SAMPLES ||
    thresholdPaceMps == null ||
    thresholdPaceMps <= 0
  ) {
    return {};
  }

  const gapSeries: TimedValue[] = runningSamples.map((sample) => ({
    timeS: sample.timeS,
    deltaS: sample.deltaS,
    value: sample.gapMps,
  }));

  const ngpMps = normalizedFourthPowerMean(gapSeries);
  if (ngpMps == null) {
    return {};
  }

  const runIntensityFactor = ngpMps / thresholdPaceMps;
  const movingTimeS = ctx.stream.quality.movingTimeS;
  const rTss = ((movingTimeS * ngpMps * runIntensityFactor) / (thresholdPaceMps * 3600)) * 100;
  const avgHr = averageHr(runningSamples);

  const sportPayload: RunningPayload = {
    ngpMps,
    runIntensityFactor,
    rTss,
    efficiencyIndex: avgHr != null && avgHr > 0 ? ngpMps / avgHr : 0,
    avgCadence: averageCadence(runningSamples),
  };

  const gapHrSamples = runningSamples
    .filter((sample) => sample.hr != null && sample.hr > 0)
    .map((sample) => ({ efficiency: sample.gapMps / sample.hr! }));

  return {
    sportPayload,
    energyKcal:
      weightKg != null && weightKg > 0
        ? acsmRunningEnergyKcal(ngpMps, weightKg, movingTimeS)
        : null,
    decouplingPct: splitEfficiencyDecoupling(gapHrSamples),
  };
}

function canComputeRunning(ctx: SportComputeContext): boolean {
  return ctx.sportFamily === "running" && ctx.athlete.thresholdPaceMps != null;
}

export const runningModule = {
  family: "running" as const,
  canCompute: canComputeRunning,
  compute: computeRunningMetrics,
};
