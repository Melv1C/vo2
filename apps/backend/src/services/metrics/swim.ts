import { acsmSwimmingEnergyKcal } from "@/services/athlete/energy";

import {
  normalizedFourthPowerMean,
  splitEfficiencyDecoupling,
  type TimedValue,
} from "./coggan-rolling";
import type { SportComputeContext, SportModuleResult, SwimmingPayload } from "./types";

const MIN_SWIM_SAMPLES = 30;

type SwimSample = {
  timeS: number;
  deltaS: number;
  velocityMps: number;
  hr: number | null;
  cadence: number | null;
};

function collectSwimSamples(stream: SportComputeContext["stream"]): SwimSample[] {
  const samples: SwimSample[] = [];

  for (const segment of stream.segments) {
    for (const sample of segment.samples) {
      if (
        !sample.moving ||
        sample.deltaS <= 0 ||
        sample.velocityMps == null ||
        sample.velocityMps <= 0
      ) {
        continue;
      }

      samples.push({
        timeS: sample.timeS,
        deltaS: sample.deltaS,
        velocityMps: sample.velocityMps,
        hr: sample.hr,
        cadence: sample.cadence,
      });
    }
  }

  return samples;
}

function averageHr(samples: SwimSample[]): number | null {
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

function averageCadence(samples: SwimSample[]): number | null {
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
 * Swimming metrics from velocity stream data.
 *
 * Computes NSP (Coggan fourth-power mean of swim speed), sTSS vs CSS (Critical Swim Speed),
 * efficiency index, and ACSM swimming energy estimate.
 *
 * CSS is stored as `thresholdSwimPaceMps` on the athlete profile.
 */
export function computeSwimmingMetrics(
  ctx: SportComputeContext,
): Pick<SportModuleResult, "sportPayload" | "energyKcal" | "decouplingPct"> {
  const cssMps = ctx.athlete.thresholdSwimPaceMps;
  const weightKg = ctx.athlete.weightKg;
  const swimSamples = collectSwimSamples(ctx.stream);

  if (swimSamples.length < MIN_SWIM_SAMPLES || cssMps == null || cssMps <= 0) {
    return {};
  }

  const speedSeries: TimedValue[] = swimSamples.map((sample) => ({
    timeS: sample.timeS,
    deltaS: sample.deltaS,
    value: sample.velocityMps,
  }));

  const nspMps = normalizedFourthPowerMean(speedSeries);
  if (nspMps == null) {
    return {};
  }

  const swimIntensityFactor = nspMps / cssMps;
  const movingTimeS = ctx.stream.quality.movingTimeS;
  const sTss = ((movingTimeS * nspMps * swimIntensityFactor) / (cssMps * 3600)) * 100;
  const avgHr = averageHr(swimSamples);

  const sportPayload: SwimmingPayload = {
    nspMps,
    swimIntensityFactor,
    sTss,
    efficiencyIndex: avgHr != null && avgHr > 0 ? nspMps / avgHr : 0,
    avgCadence: averageCadence(swimSamples),
  };

  const speedHrSamples = swimSamples
    .filter((sample) => sample.hr != null && sample.hr > 0)
    .map((sample) => ({ efficiency: sample.velocityMps / sample.hr! }));

  return {
    sportPayload,
    energyKcal:
      weightKg != null && weightKg > 0
        ? acsmSwimmingEnergyKcal(nspMps, weightKg, movingTimeS)
        : null,
    decouplingPct: splitEfficiencyDecoupling(speedHrSamples),
  };
}

function canComputeSwimming(ctx: SportComputeContext): boolean {
  return ctx.sportFamily === "swimming" && ctx.athlete.thresholdSwimPaceMps != null;
}

export const swimmingModule = {
  family: "swimming" as const,
  canCompute: canComputeSwimming,
  compute: computeSwimmingMetrics,
};
