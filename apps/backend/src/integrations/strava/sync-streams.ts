import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/database";
import { activitySyncState } from "@/database/entities/activity-sync-state";
import { account } from "@/database/entities/auth";
import {
  activityStreams,
  stravaActivities,
  type StreamsStatus,
} from "@/database/entities/strava-activities";

import { ensureValidAccessToken, type StravaAccount } from "./account";
import { stravaFetch } from "./client";
import type { StreamSet } from "./index";

const STREAMS_PER_BATCH = 15;
const STREAM_SYNC_COOLDOWN_MS = 30_000;

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

const streamSyncLocks = new Map<string, Promise<StreamSyncResult | null>>();

export type StreamSyncResult = {
  streamsSince: string | null;
  streamsReadyCount: number;
  streamsPendingCount: number;
  lastStreamSyncedAt: string | null;
  fetchedThisRun: number;
  rateLimited: boolean;
};

type ActivityStreamInsert = typeof activityStreams.$inferInsert;

function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number" &&
    (error as { status: number }).status === 429
  );
}

async function refreshSyncCounts(userId: string) {
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

function toResult(
  row: typeof activitySyncState.$inferSelect,
  fetchedThisRun: number,
  rateLimited: boolean,
): StreamSyncResult {
  return {
    streamsSince: row.streamsSince?.toISOString() ?? null,
    streamsReadyCount: row.streamsReadyCount,
    streamsPendingCount: row.streamsPendingCount,
    lastStreamSyncedAt: row.lastStreamSyncedAt?.toISOString() ?? null,
    fetchedThisRun,
    rateLimited,
  };
}

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
): Promise<StreamSet> {
  return stravaFetch<StreamSet>(`/activities/${stravaActivityId}/streams`, {
    query: {
      keys: [...STREAM_KEYS],
      key_by_type: true,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function markActivityStreamsStatus(activityId: string, status: StreamsStatus) {
  await db
    .update(stravaActivities)
    .set({ streamsStatus: status })
    .where(eq(stravaActivities.id, activityId));
}

async function persistActivityStreams(activityId: string, streamSet: StreamSet) {
  const row = mapStreamSet(activityId, streamSet);

  await db
    .insert(activityStreams)
    .values(row)
    .onConflictDoUpdate({
      target: activityStreams.activityId,
      set: {
        resolution: row.resolution,
        originalSize: row.originalSize,
        seriesType: row.seriesType,
        timeS: row.timeS,
        distanceM: row.distanceM,
        lat: row.lat,
        lng: row.lng,
        altitudeM: row.altitudeM,
        velocityMps: row.velocityMps,
        heartrate: row.heartrate,
        cadence: row.cadence,
        watts: row.watts,
        tempC: row.tempC,
        moving: row.moving,
        gradePct: row.gradePct,
        fetchedAt: row.fetchedAt,
      },
    });

  await markActivityStreamsStatus(activityId, "ready");
}

export async function setStreamsSince(
  userId: string,
  streamsSince: Date,
): Promise<StreamSyncResult> {
  await db
    .insert(activitySyncState)
    .values({
      userId,
      streamsSince,
      streamsBackfillCursor: null,
    })
    .onConflictDoUpdate({
      target: activitySyncState.userId,
      set: {
        streamsSince,
        streamsBackfillCursor: null,
      },
    });

  await db
    .update(stravaActivities)
    .set({
      streamsStatus: sql`case
        when ${stravaActivities.startDate} >= ${streamsSince} then 'pending'::text
        else 'skipped'::text
      end`,
    })
    .where(
      and(
        eq(stravaActivities.userId, userId),
        sql`${stravaActivities.streamsStatus} in ('pending', 'skipped')`,
      ),
    );

  const counts = await refreshSyncCounts(userId);

  const [row] = await db
    .update(activitySyncState)
    .set({
      activitiesCount: counts.activitiesCount,
      streamsReadyCount: counts.streamsReadyCount,
      streamsPendingCount: counts.streamsPendingCount,
    })
    .where(eq(activitySyncState.userId, userId))
    .returning();

  if (!row) {
    throw new Error("Failed to update activity sync state");
  }

  return toResult(row, 0, false);
}

export async function getStreamSyncState(userId: string): Promise<StreamSyncResult | null> {
  const [row] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, userId));

  if (!row) {
    return null;
  }

  return toResult(row, 0, false);
}

async function syncStreamsBatch(
  accountRow: StravaAccount,
  options?: { force?: boolean; limit?: number; skipCooldown?: boolean },
): Promise<StreamSyncResult | null> {
  const [syncState] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, accountRow.userId));

  if (!syncState?.streamsSince) {
    return syncState ? toResult(syncState, 0, false) : null;
  }

  if (
    !options?.force &&
    !options?.skipCooldown &&
    syncState.lastStreamSyncedAt &&
    Date.now() - syncState.lastStreamSyncedAt.getTime() < STREAM_SYNC_COOLDOWN_MS
  ) {
    return toResult(syncState, 0, false);
  }

  const accessToken = await ensureValidAccessToken(accountRow);
  const limit = options?.limit ?? STREAMS_PER_BATCH;

  const pendingActivities = await db
    .select({
      id: stravaActivities.id,
      stravaActivityId: stravaActivities.stravaActivityId,
    })
    .from(stravaActivities)
    .where(
      and(
        eq(stravaActivities.userId, accountRow.userId),
        eq(stravaActivities.streamsStatus, "pending"),
      ),
    )
    .orderBy(asc(stravaActivities.startDate))
    .limit(limit);

  let fetchedThisRun = 0;
  let rateLimited = false;
  let lastProcessedId: string | null = syncState.streamsBackfillCursor;

  for (const activity of pendingActivities) {
    try {
      const streamSet = await fetchActivityStreams(accessToken, activity.stravaActivityId);

      if (!hasStreamData(streamSet)) {
        await markActivityStreamsStatus(activity.id, "unavailable");
      } else {
        await persistActivityStreams(activity.id, streamSet);
        fetchedThisRun++;
      }

      lastProcessedId = activity.stravaActivityId;
    } catch (error) {
      if (isRateLimitError(error)) {
        rateLimited = true;
        break;
      }

      await markActivityStreamsStatus(activity.id, "unavailable");
      lastProcessedId = activity.stravaActivityId;
    }
  }

  const now = new Date();
  const counts = await refreshSyncCounts(accountRow.userId);

  const [row] = await db
    .update(activitySyncState)
    .set({
      streamsBackfillCursor: lastProcessedId,
      lastStreamSyncedAt: fetchedThisRun > 0 || rateLimited ? now : syncState.lastStreamSyncedAt,
      activitiesCount: counts.activitiesCount,
      streamsReadyCount: counts.streamsReadyCount,
      streamsPendingCount: counts.streamsPendingCount,
    })
    .where(eq(activitySyncState.userId, accountRow.userId))
    .returning();

  return row ? toResult(row, fetchedThisRun, rateLimited) : null;
}

export async function triggerStreamSyncForUser(
  userId: string,
  options?: { force?: boolean; limit?: number; skipCooldown?: boolean },
): Promise<StreamSyncResult | null> {
  const pending = streamSyncLocks.get(userId);
  if (pending) {
    return pending;
  }

  const run = (async () => {
    const [stravaAccount] = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "strava")));

    if (!stravaAccount?.accessToken) {
      return null;
    }

    return syncStreamsBatch(stravaAccount, options);
  })();

  streamSyncLocks.set(userId, run);

  try {
    return await run;
  } finally {
    streamSyncLocks.delete(userId);
  }
}
