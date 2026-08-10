export type TimedValue = {
  timeS: number;
  deltaS: number;
  value: number;
};

const COGGAN_ROLLING_WINDOW_S = 30;

/** Coggan-style normalized fourth-power mean over a time-based rolling window. */
export function normalizedFourthPowerMean(
  samples: TimedValue[],
  windowS: number = COGGAN_ROLLING_WINDOW_S,
): number | null {
  if (samples.length === 0 || windowS <= 0) {
    return null;
  }

  const rollingAverages: number[] = [];

  for (let end = 0; end < samples.length; end++) {
    let weightedSum = 0;
    let durationS = 0;
    const endTimeS = samples[end]!.timeS;

    for (let start = end; start >= 0; start--) {
      const sample = samples[start]!;
      const windowStart = endTimeS - windowS;

      if (sample.timeS < windowStart && start !== end) {
        break;
      }

      weightedSum += sample.value * sample.deltaS;
      durationS += sample.deltaS;

      if (endTimeS - sample.timeS >= windowS) {
        break;
      }
    }

    if (durationS > 0) {
      rollingAverages.push(weightedSum / durationS);
    }
  }

  if (rollingAverages.length === 0) {
    return null;
  }

  const meanFourth =
    rollingAverages.reduce((sum, value) => sum + value ** 4, 0) / rollingAverages.length;
  return meanFourth ** 0.25;
}

export function splitEfficiencyDecoupling(samples: Array<{ efficiency: number }>): number | null {
  if (samples.length < 4) {
    return null;
  }

  const midpoint = Math.floor(samples.length / 2);
  const firstHalf = samples.slice(0, midpoint);
  const secondHalf = samples.slice(midpoint);

  const average = (subset: Array<{ efficiency: number }>) =>
    subset.reduce((sum, sample) => sum + sample.efficiency, 0) / subset.length;

  const efFirst = average(firstHalf);
  const efSecond = average(secondHalf);
  if (efSecond <= 0) {
    return null;
  }

  return (efFirst / efSecond - 1) * 100;
}
