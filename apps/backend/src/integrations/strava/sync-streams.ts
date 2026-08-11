import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/database";
import { activityStreams, stravaActivities } from "@/database/entities/strava-activities";

import { isRateLimitError, stravaRequest } from "./client";
import type { StreamSet } from "./index";
import { StravaRateLimiter } from "./rate-limit";

export const STREAM_CONCURRENCY = 3;
/**
 * Max stream API calls per sync run.
 * With 200 reads/15min, ~80/run leaves room for list pagination
 * and allows ~2-3 runs before hitting the 15-min ceiling.
 */
export const STREAMS_BUDGET_PER_RUN = 60;

const STREAM_KEYS = [
  "time",
  "distance",
  "latlng",
  "altitude",
  "velocity_smooth",
  "heartrate",
  "cadence",
  "watts",
  "temp",
  "moving",
  "grade_smooth",
] as const;

export type StreamSyncResult = {
  streamsReadyCount: number;
  streamsPendingCount: number;
  lastStreamSyncedAt: string | null;
  fetchedThisRun: number;
  rateLimited: boolean;
};

type ActivityStreamInsert = typeof activityStreams.$inferInsert;

export type PendingActivity = {
  id: string;
  stravaActivityId: string;
};

export type StreamBatchResult = {
  fetched: number;
  unavailable: number;
  rateLimited: boolean;
  readyActivityIds: string[];
};

function splitLatLng(latlng: Array<[number, number]> | undefined): {
  lat: number[] | null;
  lng: number[] | null;
} {
  if (!latlng?.length) {
    return { lat: null, lng: null };
  }

  return {
    lat: latlng.map(([latitude]) => latitude),
    lng: latlng.map(([, longitude]) => longitude),
  };
}

function pickStreamMeta(streamSet: StreamSet) {
  const reference =
    streamSet.time ??
    streamSet.distance ??
    streamSet.latlng ??
    streamSet.altitude ??
    streamSet.velocity_smooth;

  return {
    resolution: reference?.resolution ?? null,
    originalSize: reference?.original_size ?? null,
    seriesType: reference?.series_type ?? null,
  };
}

function mapStreamSet(activityId: string, streamSet: StreamSet): ActivityStreamInsert {
  const meta = pickStreamMeta(streamSet);
  const { lat, lng } = splitLatLng(streamSet.latlng?.data);

  return {
    activityId,
    resolution: meta.resolution,
    originalSize: meta.originalSize,
    seriesType: meta.seriesType,
    timeS: streamSet.time?.data ?? null,
    distanceM: streamSet.distance?.data ?? null,
    lat,
    lng,
    altitudeM: streamSet.altitude?.data ?? null,
    velocityMps: streamSet.velocity_smooth?.data ?? null,
    heartrate: streamSet.heartrate?.data ?? null,
    cadence: streamSet.cadence?.data ?? null,
    watts: streamSet.watts?.data ?? null,
    tempC: streamSet.temp?.data ?? null,
    moving: streamSet.moving?.data ?? null,
    gradePct: streamSet.grade_smooth?.data ?? null,
    fetchedAt: new Date(),
  };
}

function hasStreamData(streamSet: StreamSet): boolean {
  return (
    (streamSet.time?.data?.length ?? 0) > 0 ||
    (streamSet.distance?.data?.length ?? 0) > 0 ||
    (streamSet.latlng?.data?.length ?? 0) > 0
  );
}

async function fetchActivityStreams(
  accessToken: string,
  stravaActivityId: string,
  limiter: StravaRateLimiter,
): Promise<StreamSet> {
  return stravaRequest<StreamSet>(`/activities/${stravaActivityId}/streams`, {
    query: {
      keys: STREAM_KEYS.join(","),
      key_by_type: true,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    limiter,
  });
}

async function persistActivityStreamsBatch(
  ready: ActivityStreamInsert[],
  unavailableIds: string[],
): Promise<void> {
  if (ready.length > 0) {
    await db
      .insert(activityStreams)
      .values(ready)
      .onConflictDoUpdate({
        target: activityStreams.activityId,
        set: {
          resolution: sql`excluded.resolution`,
          originalSize: sql`excluded.original_size`,
          seriesType: sql`excluded.series_type`,
          timeS: sql`excluded.time_s`,
          distanceM: sql`excluded.distance_m`,
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          altitudeM: sql`excluded.altitude_m`,
          velocityMps: sql`excluded.velocity_mps`,
          heartrate: sql`excluded.heartrate`,
          cadence: sql`excluded.cadence`,
          watts: sql`excluded.watts`,
          tempC: sql`excluded.temp_c`,
          moving: sql`excluded.moving`,
          gradePct: sql`excluded.grade_pct`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });

    await db
      .update(stravaActivities)
      .set({ streamsStatus: "ready" })
      .where(
        inArray(
          stravaActivities.id,
          ready.map((row) => row.activityId),
        ),
      );
  }

  if (unavailableIds.length > 0) {
    await db
      .update(stravaActivities)
      .set({ streamsStatus: "unavailable" })
      .where(inArray(stravaActivities.id, unavailableIds));
  }
}

type StreamFetchOutcome =
  | { kind: "ready"; row: ActivityStreamInsert }
  | { kind: "unavailable"; activityId: string }
  | { kind: "rate_limited" };

async function fetchOneStream(
  accessToken: string,
  activity: PendingActivity,
  limiter: StravaRateLimiter,
): Promise<StreamFetchOutcome> {
  if (limiter.isNearLimit) {
    return { kind: "rate_limited" };
  }

  try {
    const streamSet = await fetchActivityStreams(accessToken, activity.stravaActivityId, limiter);

    if (!hasStreamData(streamSet)) {
      return { kind: "unavailable", activityId: activity.id };
    }

    return { kind: "ready", row: mapStreamSet(activity.id, streamSet) };
  } catch (error) {
    if (isRateLimitError(error)) {
      return { kind: "rate_limited" };
    }

    return { kind: "unavailable", activityId: activity.id };
  }
}

/**
 * Fetch streams for a list of activities with controlled concurrency.
 * Stops early when rate-limited or budget exhausted.
 */
export async function syncStreamsForActivities(
  accessToken: string,
  activities: PendingActivity[],
  limiter: StravaRateLimiter,
  options?: { maxFetches?: number },
): Promise<StreamBatchResult> {
  const maxFetches = options?.maxFetches ?? STREAMS_BUDGET_PER_RUN;
  const ready: ActivityStreamInsert[] = [];
  const unavailableIds: string[] = [];
  let fetched = 0;
  let rateLimited = false;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < activities.length && fetched < maxFetches && !rateLimited) {
      if (limiter.isNearLimit) {
        rateLimited = true;
        return;
      }

      const index = cursor;
      cursor += 1;
      const activity = activities[index];
      if (!activity) {
        return;
      }

      const outcome = await fetchOneStream(accessToken, activity, limiter);

      if (outcome.kind === "rate_limited") {
        rateLimited = true;
        return;
      }

      if (outcome.kind === "ready") {
        ready.push(outcome.row);
        fetched += 1;
      } else {
        unavailableIds.push(outcome.activityId);
        fetched += 1;
      }
    }
  }

  const workers = Array.from({ length: Math.min(STREAM_CONCURRENCY, activities.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  await persistActivityStreamsBatch(ready, unavailableIds);

  return {
    fetched,
    unavailable: unavailableIds.length,
    rateLimited,
    readyActivityIds: ready.map((row) => row.activityId),
  };
}

export async function loadPendingActivities(
  userId: string,
  limit: number,
): Promise<PendingActivity[]> {
  return db
    .select({
      id: stravaActivities.id,
      stravaActivityId: stravaActivities.stravaActivityId,
    })
    .from(stravaActivities)
    .where(
      and(
        eq(stravaActivities.userId, userId),
        eq(stravaActivities.streamsStatus, "pending"),
        isNotNull(stravaActivities.averageHeartrate),
      ),
    )
    .orderBy(asc(stravaActivities.startDate))
    .limit(limit);
}

export async function loadPendingActivitiesForStravaIds(
  userId: string,
  stravaActivityIds: string[],
): Promise<PendingActivity[]> {
  if (stravaActivityIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: stravaActivities.id,
      stravaActivityId: stravaActivities.stravaActivityId,
    })
    .from(stravaActivities)
    .where(
      and(
        eq(stravaActivities.userId, userId),
        inArray(stravaActivities.stravaActivityId, stravaActivityIds),
        eq(stravaActivities.streamsStatus, "pending"),
        isNotNull(stravaActivities.averageHeartrate),
      ),
    )
    .orderBy(asc(stravaActivities.startDate));
}

export async function refreshSyncCounts(userId: string) {
  const [counts] = await db
    .select({
      activitiesCount: sql<number>`count(*)::int`,
      streamsReadyCount: sql<number>`count(*) filter (where ${stravaActivities.streamsStatus} = 'ready')::int`,
      streamsPendingCount: sql<number>`count(*) filter (where ${stravaActivities.streamsStatus} = 'pending')::int`,
    })
    .from(stravaActivities)
    .where(eq(stravaActivities.userId, userId));

  return {
    activitiesCount: counts?.activitiesCount ?? 0,
    streamsReadyCount: counts?.streamsReadyCount ?? 0,
    streamsPendingCount: counts?.streamsPendingCount ?? 0,
  };
}
