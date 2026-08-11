import type { DataQualityReport, RawStreamInput, SanitizedSample, SanitizedStream } from "./types";

const GAP_THRESHOLD_MIN_S = 5;
const GAP_THRESHOLD_MAX_S = 60;
const GAP_MULTIPLIER = 3;
const MAX_HR_TRANSITION_BPM_PER_S = 30;
const INTERPOLATION_MAX_PERIODS = 2;

const BOUNDS = {
  hr: { min: 20, max: 240 },
  power: { min: 0, max: 2500 },
  cadence: { min: 0, max: 250 },
  velocityMps: { min: 0, max: 30 },
  altitudeM: { min: -500, max: 9000 },
} as const;

function median(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function optionalAt<T>(arr: T[] | null | undefined, index: number): T | null {
  if (!arr || index >= arr.length) {
    return null;
  }
  return arr[index] ?? null;
}

function gapThresholdS(nominalDtS: number): number {
  return Math.min(GAP_THRESHOLD_MAX_S, Math.max(GAP_THRESHOLD_MIN_S, GAP_MULTIPLIER * nominalDtS));
}

function buildRawSamples(input: RawStreamInput): Array<{
  timeS: number;
  deltaS: number;
  hr: number | null;
  power: number | null;
  cadence: number | null;
  velocityMps: number | null;
  altitudeM: number | null;
  distanceM: number | null;
  gradePct: number | null;
  moving: boolean;
}> {
  const length = input.timeS?.length ?? 0;
  if (length === 0) {
    return [];
  }

  const samples = [];
  for (let i = 0; i < length; i++) {
    const timeS = input.timeS![i]!;
    const prevTime = i > 0 ? input.timeS![i - 1]! : timeS;
    const deltaS = i === 0 ? 0 : Math.max(0, timeS - prevTime);

    samples.push({
      timeS,
      deltaS,
      hr: optionalAt(input.heartrate, i),
      power: optionalAt(input.watts, i),
      cadence: optionalAt(input.cadence, i),
      velocityMps: optionalAt(input.velocityMps, i),
      altitudeM: optionalAt(input.altitudeM, i),
      distanceM: optionalAt(input.distanceM, i),
      gradePct: optionalAt(input.gradePct, i),
      moving: optionalAt(input.moving, i) ?? true,
    });
  }

  return samples;
}

function passesBounds(sample: ReturnType<typeof buildRawSamples>[number]): boolean {
  if (sample.hr != null && !inRange(sample.hr, BOUNDS.hr.min, BOUNDS.hr.max)) {
    return false;
  }
  if (sample.power != null && !inRange(sample.power, BOUNDS.power.min, BOUNDS.power.max)) {
    return false;
  }
  if (sample.cadence != null && !inRange(sample.cadence, BOUNDS.cadence.min, BOUNDS.cadence.max)) {
    return false;
  }
  if (
    sample.velocityMps != null &&
    !inRange(sample.velocityMps, BOUNDS.velocityMps.min, BOUNDS.velocityMps.max)
  ) {
    return false;
  }
  if (
    sample.altitudeM != null &&
    !inRange(sample.altitudeM, BOUNDS.altitudeM.min, BOUNDS.altitudeM.max)
  ) {
    return false;
  }
  return true;
}

function passesTransition(prev: SanitizedSample | null, current: SanitizedSample): boolean {
  if (prev?.hr == null || current.hr == null || current.deltaS <= 0) {
    return true;
  }
  const rate = Math.abs(current.hr - prev.hr) / current.deltaS;
  return rate <= MAX_HR_TRANSITION_BPM_PER_S;
}

function interpolateShortGaps(samples: SanitizedSample[], nominalDtS: number): SanitizedSample[] {
  const maxGapS = INTERPOLATION_MAX_PERIODS * nominalDtS;
  const result: SanitizedSample[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!;
    if (sample.deltaS <= maxGapS || i === 0) {
      result.push(sample);
      continue;
    }

    const prev = result[result.length - 1];
    if (!prev || prev.hr == null || sample.hr == null) {
      result.push(sample);
      continue;
    }

    const steps = Math.max(1, Math.round(sample.deltaS / nominalDtS));
    for (let step = 1; step <= steps; step++) {
      const fraction = step / steps;
      result.push({
        ...sample,
        deltaS: sample.deltaS / steps,
        hr: prev.hr + (sample.hr - prev.hr) * fraction,
      });
    }
  }

  return result;
}

function toSanitizedSample(sample: ReturnType<typeof buildRawSamples>[number]): SanitizedSample {
  return {
    timeS: sample.timeS,
    deltaS: sample.deltaS,
    hr: sample.hr,
    power: sample.power,
    cadence: sample.cadence,
    velocityMps: sample.velocityMps,
    altitudeM: sample.altitudeM,
    distanceM: sample.distanceM,
    gradePct: sample.gradePct,
    moving: sample.moving,
  };
}

/**
 * Converts raw stream arrays into gap-segmented, bounded samples.
 * Pure function — no DB access. Drops out-of-range values and impossible HR transitions.
 */
export function sanitizeStream(input: RawStreamInput): SanitizedStream {
  const raw = buildRawSamples(input);
  const samplesIn = raw.length;

  if (raw.length === 0) {
    return {
      segments: [],
      quality: {
        samplesIn: 0,
        samplesDropped: 0,
        segments: 0,
        longestGapS: 0,
        nominalDtS: 1,
        coveragePct: 0,
        movingTimeS: 0,
      },
    };
  }

  const deltas = raw
    .slice(1)
    .map((s) => s.deltaS)
    .filter((d) => d > 0);
  const nominalDtS = median(deltas);
  const gapAt = gapThresholdS(nominalDtS);

  const segmentBatches: SanitizedSample[][] = [[]];
  let longestGapS = 0;
  let samplesDropped = 0;
  let prevKept: SanitizedSample | null = null;

  for (const sample of raw) {
    if (sample.deltaS > gapAt) {
      longestGapS = Math.max(longestGapS, sample.deltaS);
      if (segmentBatches[segmentBatches.length - 1]!.length > 0) {
        segmentBatches.push([]);
      }
      prevKept = null;
      continue;
    }

    if (!passesBounds(sample)) {
      samplesDropped += 1;
      continue;
    }

    const sanitized = toSanitizedSample(sample);
    if (!passesTransition(prevKept, sanitized)) {
      samplesDropped += 1;
      continue;
    }

    const current = segmentBatches[segmentBatches.length - 1]!;
    current.push(sanitized);
    prevKept = sanitized;
  }

  const segments = segmentBatches
    .map((batch) => ({
      samples: interpolateShortGaps(batch, nominalDtS),
    }))
    .filter((segment) => segment.samples.length > 0);

  let movingTimeS = 0;
  for (const segment of segments) {
    for (const sample of segment.samples) {
      if (sample.moving && sample.deltaS > 0) {
        movingTimeS += sample.deltaS;
      }
    }
  }

  const kept = segments.reduce((sum, segment) => sum + segment.samples.length, 0);
  const coveragePct = samplesIn > 0 ? (kept / samplesIn) * 100 : 0;

  const quality: DataQualityReport = {
    samplesIn,
    samplesDropped,
    segments: segments.length,
    longestGapS,
    nominalDtS,
    coveragePct,
    movingTimeS,
  };

  return { segments, quality };
}
