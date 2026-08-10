import { and, eq, sql } from "drizzle-orm";

import { db } from "@/database";
import { activitySyncState } from "@/database/entities/activity-sync-state";
import { athleteProfile } from "@/database/entities/athlete-profile";
import { account } from "@/database/entities/auth";
import { stravaActivities, type StreamsStatus } from "@/database/entities/strava-activities";
import { logger } from "@/lib/logger";

import { ensureValidAccessToken, type StravaAccount } from "./account";
import { stravaRequest } from "./client";
import type { SummaryActivity } from "./index";
import { getSharedRateLimiter, type StravaRateLimiter } from "./rate-limit";
import {
  loadPendingActivities,
  loadPendingActivitiesForStravaIds,
  refreshSyncCounts,
  STREAMS_BUDGET_PER_RUN,
  syncStreamsForActivities,
} from "./sync-streams";

const ACTIVITIES_PER_PAGE = 200;
const SYNC_COOLDOWN_MS = 30_000;

const syncLocks = new Map<string, Promise<SyncResult | null>>();

export type ActivitySyncSummary = {
  activitiesCount: number;
  lastFetchedAt: string | null;
  newActivities: number;
};

export type SyncResult = ActivitySyncSummary & {
  streamsReadyCount: number;
  streamsPendingCount: number;
  lastStreamSyncedAt: string | null;
  streamsFetchedThisRun: number;
  rateLimited: boolean;
};

type ActivityInsert = typeof stravaActivities.$inferInsert;

type StravaListActivity = SummaryActivity & {
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
};

type RunSyncOptions = {
  force?: boolean;
  /** Skip summary sync, only drain pending streams. */
  streamsOnly?: boolean;
};

function toSummary(
  row: typeof activitySyncState.$inferSelect,
  newActivities: number,
  streamsFetchedThisRun: number,
  rateLimited: boolean,
): SyncResult {
  return {
    activitiesCount: row.activitiesCount,
    lastFetchedAt: row.lastSummarySyncedAt?.toISOString() ?? null,
    newActivities,
    streamsReadyCount: row.streamsReadyCount,
    streamsPendingCount: row.streamsPendingCount,
    lastStreamSyncedAt: row.lastStreamSyncedAt?.toISOString() ?? null,
    streamsFetchedThisRun,
    rateLimited,
  };
}

function streamsStatusFor(averageHeartrate: number | null | undefined): StreamsStatus {
  return averageHeartrate != null ? "pending" : "skipped";
}

function mapActivity(userId: string, activity: StravaListActivity): ActivityInsert | null {
  if (activity.id == null || !activity.start_date) {
    return null;
  }

  const startDate = new Date(activity.start_date);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const startDateLocal = activity.start_date_local ? new Date(activity.start_date_local) : null;

  return {
    userId,
    stravaActivityId: String(activity.id),
    sportType: activity.sport_type ?? activity.type ?? null,
    name: activity.name ?? null,
    startDate,
    startDateLocal:
      startDateLocal && !Number.isNaN(startDateLocal.getTime()) ? startDateLocal : null,
    timezone: activity.timezone ?? null,
    distance: activity.distance ?? null,
    movingTime: activity.moving_time ?? null,
    elapsedTime: activity.elapsed_time ?? null,
    totalElevationGain: activity.total_elevation_gain ?? null,
    elevHigh: activity.elev_high ?? null,
    elevLow: activity.elev_low ?? null,
    averageSpeed: activity.average_speed ?? null,
    maxSpeed: activity.max_speed ?? null,
    workoutType: activity.workout_type ?? null,
    gearId: activity.gear_id ?? null,
    averageHeartrate: activity.average_heartrate ?? null,
    maxHeartrate: activity.max_heartrate ?? null,
    averageCadence: activity.average_cadence ?? null,
    averageWatts: activity.average_watts ?? null,
    weightedAverageWatts: activity.weighted_average_watts ?? null,
    maxWatts: activity.max_watts ?? null,
    kilojoules: activity.kilojoules ?? null,
    calories: activity.calories ?? null,
    streamsStatus: streamsStatusFor(activity.average_heartrate ?? null),
  };
}

async function batchUpsertActivities(rows: ActivityInsert[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const inserted = await db
    .insert(stravaActivities)
    .values(rows)
    .onConflictDoUpdate({
      target: [stravaActivities.userId, stravaActivities.stravaActivityId],
      set: {
        sportType: sql`excluded.sport_type`,
        name: sql`excluded.name`,
        startDate: sql`excluded.start_date`,
        startDateLocal: sql`excluded.start_date_local`,
        timezone: sql`excluded.timezone`,
        distance: sql`excluded.distance`,
        movingTime: sql`excluded.moving_time`,
        elapsedTime: sql`excluded.elapsed_time`,
        totalElevationGain: sql`excluded.total_elevation_gain`,
        elevHigh: sql`excluded.elev_high`,
        elevLow: sql`excluded.elev_low`,
        averageSpeed: sql`excluded.average_speed`,
        maxSpeed: sql`excluded.max_speed`,
        workoutType: sql`excluded.workout_type`,
        gearId: sql`excluded.gear_id`,
        averageHeartrate: sql`excluded.average_heartrate`,
        maxHeartrate: sql`excluded.max_heartrate`,
        averageCadence: sql`excluded.average_cadence`,
        averageWatts: sql`excluded.average_watts`,
        weightedAverageWatts: sql`excluded.weighted_average_watts`,
        maxWatts: sql`excluded.max_watts`,
        kilojoules: sql`excluded.kilojoules`,
        calories: sql`excluded.calories`,
        streamsStatus: sql`case
          when ${stravaActivities.streamsStatus} = 'ready' then 'ready'
          when excluded.average_heartrate is not null then 'pending'
          else 'skipped'
        end`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: stravaActivities.id });

  return inserted.length;
}

async function syncSummaries(
  accountRow: StravaAccount,
  accessToken: string,
  limiter: StravaRateLimiter,
  onPageSynced?: (pageStravaIds: string[]) => Promise<{ fetched: number; rateLimited: boolean }>,
): Promise<{
  upserted: number;
  maxStartEpoch: number;
  backfillComplete: boolean;
  streamsFetched: number;
  rateLimited: boolean;
}> {
  const [profile] = await db
    .select()
    .from(athleteProfile)
    .where(eq(athleteProfile.userId, accountRow.userId));

  if (!profile?.athleteCreatedAt) {
    logger.warn("[strava-sync] missing athleteCreatedAt on athlete_profile, skipping", {
      userId: accountRow.userId,
    });
    return {
      upserted: 0,
      maxStartEpoch: 0,
      backfillComplete: false,
      streamsFetched: 0,
      rateLimited: false,
    };
  }

  const [existing] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, accountRow.userId));

  const afterEpoch =
    existing?.summariesCursor ?? Math.floor(profile.athleteCreatedAt.getTime() / 1000) - 1;

  let page = 1;
  let upserted = 0;
  let streamsFetched = 0;
  let maxStartEpoch = afterEpoch;
  let backfillComplete = existing?.summariesBackfillComplete ?? false;
  let rateLimited = false;

  while (!rateLimited) {
    if (limiter.isNearLimit) {
      rateLimited = true;
      break;
    }

    const pageActivities = await stravaRequest<StravaListActivity[]>("/athlete/activities", {
      query: {
        after: afterEpoch,
        page,
        per_page: ACTIVITIES_PER_PAGE,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      limiter,
    });

    if (pageActivities.length === 0) {
      backfillComplete = true;
      break;
    }

    const rows = pageActivities
      .map((activity) => mapActivity(accountRow.userId, activity))
      .filter((row): row is ActivityInsert => row != null);

    upserted += await batchUpsertActivities(rows);

    const pageIds = rows.map((row) => row.stravaActivityId);

    if (onPageSynced && pageIds.length > 0) {
      const pageStreamResult = await onPageSynced(pageIds);
      streamsFetched += pageStreamResult.fetched;
      if (pageStreamResult.rateLimited) {
        rateLimited = true;
        break;
      }
    }

    for (const row of rows) {
      const epoch = Math.floor(row.startDate.getTime() / 1000);
      if (epoch > maxStartEpoch) {
        maxStartEpoch = epoch;
      }
    }

    if (pageActivities.length < ACTIVITIES_PER_PAGE) {
      backfillComplete = true;
      break;
    }

    page++;
  }

  return { upserted, maxStartEpoch, backfillComplete, streamsFetched, rateLimited };
}

async function drainPendingStreams(
  accountRow: StravaAccount,
  accessToken: string,
  limiter: StravaRateLimiter,
  budget: number,
): Promise<{ fetched: number; rateLimited: boolean }> {
  let totalFetched = 0;
  let rateLimited = false;

  while (totalFetched < budget && !rateLimited) {
    const remaining = budget - totalFetched;
    const pending = await loadPendingActivities(accountRow.userId, remaining);

    if (pending.length === 0) {
      break;
    }

    const result = await syncStreamsForActivities(accessToken, pending, limiter, {
      maxFetches: remaining,
    });

    totalFetched += result.fetched;
    rateLimited = result.rateLimited;

    if (result.fetched === 0) {
      break;
    }
  }

  return { fetched: totalFetched, rateLimited };
}

async function runSync(
  accountRow: StravaAccount,
  options?: RunSyncOptions,
): Promise<SyncResult | null> {
  const limiter = getSharedRateLimiter();
  const accessToken = await ensureValidAccessToken(accountRow);

  let upserted = 0;
  let maxStartEpoch: number | undefined;
  let backfillComplete: boolean | undefined;
  let streamsFetched = 0;
  let rateLimited = false;

  const streamBudgetRef = { remaining: STREAMS_BUDGET_PER_RUN };

  const onPageSynced = async (pageStravaIds: string[]) => {
    if (streamBudgetRef.remaining <= 0 || limiter.isNearLimit) {
      return { fetched: 0, rateLimited: limiter.isNearLimit };
    }

    const pagePending = await loadPendingActivitiesForStravaIds(accountRow.userId, pageStravaIds);

    if (pagePending.length === 0) {
      return { fetched: 0, rateLimited: false };
    }

    const result = await syncStreamsForActivities(accessToken, pagePending, limiter, {
      maxFetches: streamBudgetRef.remaining,
    });
    streamBudgetRef.remaining -= result.fetched;
    return { fetched: result.fetched, rateLimited: result.rateLimited };
  };

  if (!options?.streamsOnly) {
    const summaryResult = await syncSummaries(accountRow, accessToken, limiter, onPageSynced);
    upserted = summaryResult.upserted;
    maxStartEpoch = summaryResult.maxStartEpoch;
    backfillComplete = summaryResult.backfillComplete;
    streamsFetched = summaryResult.streamsFetched;
    rateLimited = summaryResult.rateLimited;
  }

  if (!rateLimited) {
    const remainingBudget = streamBudgetRef.remaining;
    if (remainingBudget > 0) {
      const drainResult = await drainPendingStreams(
        accountRow,
        accessToken,
        limiter,
        remainingBudget,
      );
      streamsFetched += drainResult.fetched;
      rateLimited = drainResult.rateLimited;
    }
  }

  const now = new Date();
  const counts = await refreshSyncCounts(accountRow.userId);

  const [existing] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, accountRow.userId));

  const [row] = await db
    .insert(activitySyncState)
    .values({
      userId: accountRow.userId,
      summariesBackfillComplete: backfillComplete ?? existing?.summariesBackfillComplete ?? false,
      summariesCursor: maxStartEpoch ?? existing?.summariesCursor,
      lastSummarySyncedAt: options?.streamsOnly ? existing?.lastSummarySyncedAt : now,
      lastStreamSyncedAt: streamsFetched > 0 || rateLimited ? now : existing?.lastStreamSyncedAt,
      activitiesCount: counts.activitiesCount,
      streamsReadyCount: counts.streamsReadyCount,
      streamsPendingCount: counts.streamsPendingCount,
    })
    .onConflictDoUpdate({
      target: activitySyncState.userId,
      set: {
        ...(backfillComplete != null ? { summariesBackfillComplete: backfillComplete } : {}),
        ...(maxStartEpoch != null ? { summariesCursor: maxStartEpoch } : {}),
        ...(!options?.streamsOnly ? { lastSummarySyncedAt: now } : {}),
        ...(streamsFetched > 0 || rateLimited ? { lastStreamSyncedAt: now } : {}),
        activitiesCount: counts.activitiesCount,
        streamsReadyCount: counts.streamsReadyCount,
        streamsPendingCount: counts.streamsPendingCount,
      },
    })
    .returning();

  return row ? toSummary(row, upserted, streamsFetched, rateLimited) : null;
}

export async function getActivitiesSummary(userId: string): Promise<ActivitySyncSummary | null> {
  const [row] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, userId));

  if (!row) {
    return null;
  }

  return {
    activitiesCount: row.activitiesCount,
    lastFetchedAt: row.lastSummarySyncedAt?.toISOString() ?? null,
    newActivities: 0,
  };
}

export async function getSyncState(userId: string): Promise<SyncResult | null> {
  const [row] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, userId));

  if (!row) {
    return null;
  }

  return toSummary(row, 0, 0, false);
}

/**
 * Unified sync: summaries + streams in one pipeline, rate-limit aware.
 * Returns immediately if another sync is already running for this user.
 */
export async function runSyncForUser(
  userId: string,
  options?: RunSyncOptions,
): Promise<SyncResult | null> {
  const pending = syncLocks.get(userId);
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

    if (!options?.force && !options?.streamsOnly) {
      const [existing] = await db
        .select()
        .from(activitySyncState)
        .where(eq(activitySyncState.userId, userId));

      if (
        existing?.lastSummarySyncedAt &&
        Date.now() - existing.lastSummarySyncedAt.getTime() < SYNC_COOLDOWN_MS
      ) {
        if (existing.streamsPendingCount > 0) {
          return runSync(stravaAccount, { streamsOnly: true });
        }
        return getSyncState(userId);
      }
    }

    return runSync(stravaAccount, options);
  })();

  syncLocks.set(userId, run);

  try {
    return await run;
  } finally {
    syncLocks.delete(userId);
  }
}

/** @deprecated Use runSyncForUser */
export async function triggerActivitySyncForUser(
  userId: string,
  options?: { force?: boolean },
): Promise<ActivitySyncSummary | null> {
  const result = await runSyncForUser(userId, options);
  if (!result) {
    return null;
  }
  return {
    activitiesCount: result.activitiesCount,
    lastFetchedAt: result.lastFetchedAt,
    newActivities: result.newActivities,
  };
}

/** Kick sync in background; no-op if already running. */
export function kickBackgroundSync(userId: string): void {
  void runSyncForUser(userId).catch((error) => {
    logger.error("[strava-sync] background sync failed", { userId, error });
  });
}

/** Continue stream drain after rate limit; skips summary cooldown. */
export function kickStreamDrain(userId: string): void {
  void runSyncForUser(userId, { streamsOnly: true }).catch((error) => {
    logger.error("[strava-stream-sync] stream drain failed", { userId, error });
  });
}
