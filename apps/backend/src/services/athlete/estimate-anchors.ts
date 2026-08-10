import { and, eq } from "drizzle-orm";

import { db } from "@/database";
import { athleteProfile } from "@/database/entities/athlete-profile";
import {
  activityStreams,
  stravaActivities,
} from "@/database/entities/strava-activities";
import {
  bestRollingMean,
  confidenceForWindow,
  type EstimateConfidence,
  type SeriesPoint,
} from "@/services/athlete/rolling-window";
import { sanitizeStream } from "@/services/metrics/sanitize-stream";
import { resolveSportFamily } from "@/services/metrics/sport-family";
import type { RawStreamInput } from "@/services/metrics/types";

export type { EstimateConfidence } from "@/services/athlete/rolling-window";

export type AnchorProposal = {
  value: number;
  confidence: EstimateConfidence;
  activityId: string;
  activityDate: string;
  method: string;
};

export type AnchorEstimates = {
  maxHr: AnchorProposal | null;
  lthr: AnchorProposal | null;
  ftp: AnchorProposal | null;
  thresholdPaceMps: AnchorProposal | null;
  maxHrDriftSuggested: boolean;
};

const HRMAX_WINDOW_S = 60;
const LTHR_WINDOW_S = 20 * 60;
const FTP_WINDOW_S = 20 * 60;
const PACE_WINDOW_S = 20 * 60;

function hrSeriesFromSanitized(
  input: RawStreamInput,
): SeriesPoint[] {
  const sanitized = sanitizeStream(input);
  const points: SeriesPoint[] = [];

  for (const segment of sanitized.segments) {
    for (const sample of segment.samples) {
      if (!sample.moving || sample.hr == null) {
        continue;
      }
      points.push({ timeS: sample.timeS, value: sample.hr });
    }
  }

  return points;
}

function powerSeriesFromSanitized(input: RawStreamInput): SeriesPoint[] {
  const sanitized = sanitizeStream(input);
  const points: SeriesPoint[] = [];

  for (const segment of sanitized.segments) {
    for (const sample of segment.samples) {
      if (!sample.moving || sample.power == null || sample.power <= 0) {
        continue;
      }
      points.push({ timeS: sample.timeS, value: sample.power });
    }
  }

  return points;
}

function paceSeriesFromSanitized(input: RawStreamInput): SeriesPoint[] {
  const sanitized = sanitizeStream(input);
  const points: SeriesPoint[] = [];

  for (const segment of sanitized.segments) {
    for (const sample of segment.samples) {
      if (!sample.moving || sample.velocityMps == null || sample.velocityMps <= 0) {
        continue;
      }
      points.push({ timeS: sample.timeS, value: sample.velocityMps });
    }
  }

  return points;
}

function toRawStreamInput(stream: typeof activityStreams.$inferSelect): RawStreamInput {
  return {
    timeS: stream.timeS,
    distanceM: stream.distanceM,
    altitudeM: stream.altitudeM,
    velocityMps: stream.velocityMps,
    heartrate: stream.heartrate,
    cadence: stream.cadence,
    watts: stream.watts,
    moving: stream.moving,
    gradePct: stream.gradePct,
  };
}

function pickBestProposal(
  current: AnchorProposal | null,
  candidate: AnchorProposal,
  compare: (next: number, best: number) => boolean,
): AnchorProposal {
  if (!current || compare(candidate.value, current.value)) {
    return candidate;
  }
  return current;
}

export async function estimateAnchorsFromHistory(userId: string): Promise<AnchorEstimates> {
  const [profile] = await db
    .select({
      maxHr: athleteProfile.maxHr,
    })
    .from(athleteProfile)
    .where(eq(athleteProfile.userId, userId));

  const rows = await db
    .select({
      activityId: stravaActivities.id,
      sportType: stravaActivities.sportType,
      startDate: stravaActivities.startDate,
      movingTime: stravaActivities.movingTime,
      deviceWatts: stravaActivities.deviceWatts,
      stream: activityStreams,
    })
    .from(stravaActivities)
    .innerJoin(activityStreams, eq(activityStreams.activityId, stravaActivities.id))
    .where(and(eq(stravaActivities.userId, userId), eq(stravaActivities.streamsStatus, "ready")));

  let maxHr: AnchorProposal | null = null;
  let lthr: AnchorProposal | null = null;
  let ftp: AnchorProposal | null = null;
  let thresholdPaceMps: AnchorProposal | null = null;

  for (const row of rows) {
    const raw = toRawStreamInput(row.stream);
    const activityDate = row.startDate.toISOString();
    const sportFamily = resolveSportFamily(row.sportType);

    const hrPoints = hrSeriesFromSanitized(raw);
    if (hrPoints.length > 0) {
      const hrMaxWindow = bestRollingMean(hrPoints, HRMAX_WINDOW_S);
      if (hrMaxWindow) {
        const segmentDurationS = hrMaxWindow.endTimeS - hrMaxWindow.startTimeS;
        maxHr = pickBestProposal(
          maxHr,
          {
            value: Math.round(hrMaxWindow.mean),
            confidence: confidenceForWindow(HRMAX_WINDOW_S, segmentDurationS, row.movingTime),
            activityId: row.activityId,
            activityDate,
            method: "best_60s_rolling_mean_hr",
          },
          (next, best) => next > best,
        );
      }

      const lthrWindow = bestRollingMean(hrPoints, LTHR_WINDOW_S);
      if (lthrWindow) {
        const segmentDurationS = lthrWindow.endTimeS - lthrWindow.startTimeS;
        lthr = pickBestProposal(
          lthr,
          {
            value: Math.round(lthrWindow.mean),
            confidence: confidenceForWindow(LTHR_WINDOW_S, segmentDurationS, row.movingTime),
            activityId: row.activityId,
            activityDate,
            method: "best_20min_rolling_mean_hr",
          },
          (next, best) => next > best,
        );
      }
    }

    if (sportFamily === "cycling" && row.deviceWatts === true) {
      const powerPoints = powerSeriesFromSanitized(raw);
      const ftpWindow = bestRollingMean(powerPoints, FTP_WINDOW_S);
      if (ftpWindow) {
        const segmentDurationS = ftpWindow.endTimeS - ftpWindow.startTimeS;
        ftp = pickBestProposal(
          ftp,
          {
            value: Math.round(ftpWindow.mean * 0.95),
            confidence: confidenceForWindow(FTP_WINDOW_S, segmentDurationS, row.movingTime),
            activityId: row.activityId,
            activityDate,
            method: "best_20min_mean_power_x_0.95",
          },
          (next, best) => next > best,
        );
      }
    }

    if (sportFamily === "running") {
      const pacePoints = paceSeriesFromSanitized(raw);
      const paceWindow = bestRollingMean(pacePoints, PACE_WINDOW_S);
      if (paceWindow) {
        const segmentDurationS = paceWindow.endTimeS - paceWindow.startTimeS;
        const paceConfidence: EstimateConfidence =
          row.movingTime != null && row.movingTime >= PACE_WINDOW_S * 2
            ? confidenceForWindow(PACE_WINDOW_S, segmentDurationS, row.movingTime)
            : "low";

        thresholdPaceMps = pickBestProposal(
          thresholdPaceMps,
          {
            value: Number(paceWindow.mean.toFixed(2)),
            confidence: paceConfidence,
            activityId: row.activityId,
            activityDate,
            method: "best_20min_rolling_mean_velocity",
          },
          (next, best) => next > best,
        );
      }
    }
  }

  const storedMaxHr = profile?.maxHr ?? null;
  const maxHrDriftSuggested =
    maxHr != null && storedMaxHr != null ? maxHr.value > storedMaxHr : maxHr != null && storedMaxHr == null;

  return {
    maxHr,
    lthr,
    ftp,
    thresholdPaceMps,
    maxHrDriftSuggested,
  };
}
