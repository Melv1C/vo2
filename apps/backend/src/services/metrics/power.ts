import {
  normalizedFourthPowerMean,
  splitEfficiencyDecoupling,
  type TimedValue,
} from "./coggan-rolling";
import type { SanitizedStream } from "./types";
import type { CyclingPayload, SportComputeContext, SportModuleResult } from "./types";

const MIN_POWER_SAMPLES = 30;

function collectPowerSamples(stream: SanitizedStream): TimedValue[] {
  const samples: TimedValue[] = [];

  for (const segment of stream.segments) {
    for (const sample of segment.samples) {
      if (!sample.moving || sample.deltaS <= 0 || sample.power == null || sample.power <= 0) {
        continue;
      }
      samples.push({
        timeS: sample.timeS,
        deltaS: sample.deltaS,
        value: sample.power,
      });
    }
  }

  return samples;
}

function collectPowerHrSamples(stream: SanitizedStream): Array<{ efficiency: number }> {
  const samples: Array<{ efficiency: number }> = [];

  for (const segment of stream.segments) {
    for (const sample of segment.samples) {
      if (
        !sample.moving ||
        sample.deltaS <= 0 ||
        sample.power == null ||
        sample.power <= 0 ||
        sample.hr == null ||
        sample.hr <= 0
      ) {
        continue;
      }
      samples.push({ efficiency: sample.power / sample.hr });
    }
  }

  return samples;
}

function computeWorkKj(powerSamples: TimedValue[]): number {
  return powerSamples.reduce((sum, sample) => sum + (sample.value * sample.deltaS) / 1000, 0);
}

function computeAveragePower(powerSamples: TimedValue[]): number | null {
  let weightedSum = 0;
  let durationS = 0;

  for (const sample of powerSamples) {
    weightedSum += sample.value * sample.deltaS;
    durationS += sample.deltaS;
  }

  if (durationS <= 0) {
    return null;
  }

  return weightedSum / durationS;
}

export function computeCyclingMetrics(
  ctx: SportComputeContext,
): Pick<SportModuleResult, "sportPayload" | "energyKcal" | "decouplingPct"> {
  const powerSamples = collectPowerSamples(ctx.stream);
  const ftp = ctx.athlete.ftp;
  const weightKg = ctx.athlete.weightKg;

  if (powerSamples.length < MIN_POWER_SAMPLES || ftp == null || ftp <= 0) {
    return {};
  }

  const np = normalizedFourthPowerMean(powerSamples);
  const avgPower = computeAveragePower(powerSamples);
  if (np == null || avgPower == null || avgPower <= 0) {
    return {};
  }

  const intensityFactor = np / ftp;
  const movingTimeS = ctx.stream.quality.movingTimeS;
  const tss = ((movingTimeS * np * intensityFactor) / (ftp * 3600)) * 100;
  const workKj = computeWorkKj(powerSamples);
  const wattsPerKg = weightKg != null && weightKg > 0 ? np / weightKg : 0;

  const sportPayload: CyclingPayload = {
    np,
    intensityFactor,
    tss,
    variabilityIndex: np / avgPower,
    workKj,
    wattsPerKg,
  };

  return {
    sportPayload,
    energyKcal: workKj / 4.184,
    decouplingPct: splitEfficiencyDecoupling(collectPowerHrSamples(ctx.stream)),
  };
}

function canComputeCycling(ctx: SportComputeContext): boolean {
  return ctx.sportFamily === "cycling" && ctx.deviceWatts === true;
}

export const cyclingModule = {
  family: "cycling" as const,
  canCompute: canComputeCycling,
  compute: computeCyclingMetrics,
};
