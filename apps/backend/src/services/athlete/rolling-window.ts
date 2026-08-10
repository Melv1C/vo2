export type SeriesPoint = {
  timeS: number;
  value: number;
};

export function bestRollingMean(
  points: SeriesPoint[],
  windowS: number,
): { mean: number; startTimeS: number; endTimeS: number } | null {
  if (points.length === 0 || windowS <= 0) {
    return null;
  }

  let best: { mean: number; startTimeS: number; endTimeS: number } | null = null;
  let sum = 0;
  let start = 0;

  for (let end = 0; end < points.length; end++) {
    sum += points[end]!.value;

    while (points[end]!.timeS - points[start]!.timeS > windowS) {
      sum -= points[start]!.value;
      start++;
    }

    const durationS = points[end]!.timeS - points[start]!.timeS;
    if (durationS + 1e-6 < windowS) {
      continue;
    }

    const count = end - start + 1;
    const mean = sum / count;

    if (!best || mean > best.mean) {
      best = {
        mean,
        startTimeS: points[start]!.timeS,
        endTimeS: points[end]!.timeS,
      };
    }
  }

  return best;
}

export type EstimateConfidence = "low" | "medium" | "high";

export function confidenceForWindow(
  windowS: number,
  segmentDurationS: number,
  movingTimeS: number | null,
): EstimateConfidence {
  const referenceDuration = movingTimeS ?? segmentDurationS;

  if (referenceDuration >= windowS * 2) {
    return "high";
  }
  if (referenceDuration >= windowS * 1.1) {
    return "medium";
  }
  return "low";
}
