import { and, eq, sql } from "drizzle-orm";
import { ENV } from "varlock/env";

import { db } from "@/database";
import { activitySyncState } from "@/database/entities/activity-sync-state";
import { athleteProfile } from "@/database/entities/athlete-profile";
import { account } from "@/database/entities/auth";
import { stravaActivities, type StreamsStatus } from "@/database/entities/strava-activities";

import { stravaFetch, stravaOAuthFetch } from "./client";
import type { SummaryActivity } from "./index";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const ACTIVITIES_PER_PAGE = 200;
const SYNC_COOLDOWN_MS = 30_000;

const syncLocks = new Map<string, Promise<ActivitySyncSummary | null>>();

export type ActivitySyncSummary = {
  activitiesCount: number;
  lastFetchedAt: string | null;
  newActivities: number;
};

type StravaAccount = {
  id: string;
  userId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: Date | null;
};

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

/** OpenAPI SummaryActivity omits several fields Strava returns on list. */
type StravaListActivity = SummaryActivity & {
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
};

type ActivityInsert = typeof stravaActivities.$inferInsert;

function toSummary(
  row: typeof activitySyncState.$inferSelect,
  newActivities: number,
): ActivitySyncSummary {
  return {
    activitiesCount: row.activitiesCount,
    lastFetchedAt: row.lastSummarySyncedAt?.toISOString() ?? null,
    newActivities,
  };
}

function streamsStatusFor(startDate: Date, streamsSince: Date | null | undefined): StreamsStatus {
  if (!streamsSince) {
    return "skipped";
  }
  return startDate >= streamsSince ? "pending" : "skipped";
}

function mapActivity(
  userId: string,
  activity: StravaListActivity,
  streamsSince: Date | null | undefined,
): ActivityInsert | null {
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
    streamsStatus: streamsStatusFor(startDate, streamsSince),
  };
}

async function refreshAccessToken(accountRow: StravaAccount): Promise<string> {
  if (!accountRow.refreshToken) {
    throw new Error("Missing Strava refresh token");
  }

  const tokens = await stravaOAuthFetch<StravaTokenResponse>("/oauth/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: ENV.STRAVA_CLIENT_ID,
      client_secret: ENV.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: accountRow.refreshToken,
    }),
  });

  await db
    .update(account)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: new Date(tokens.expires_at * 1000),
    })
    .where(eq(account.id, accountRow.id));

  return tokens.access_token;
}

async function ensureValidAccessToken(accountRow: StravaAccount): Promise<string> {
  if (!accountRow.accessToken) {
    throw new Error("Missing Strava access token");
  }

  const expiresAt = accountRow.accessTokenExpiresAt?.getTime();
  if (expiresAt && expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return accountRow.accessToken;
  }

  return refreshAccessToken(accountRow);
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
        updatedAt: new Date(),
        // Preserve streams_status (ready / unavailable / user-gated skipped).
      },
    })
    .returning({ id: stravaActivities.id });

  return inserted.length;
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

async function syncAthleteActivities(
  accountRow: StravaAccount,
): Promise<ActivitySyncSummary | null> {
  const accessToken = await ensureValidAccessToken(accountRow);

  const [profile] = await db
    .select()
    .from(athleteProfile)
    .where(eq(athleteProfile.userId, accountRow.userId));

  if (!profile?.athleteCreatedAt) {
    console.warn(
      `[strava-sync] user=${accountRow.userId} missing athleteCreatedAt on athlete_profile, skipping`,
    );
    return null;
  }

  const [existing] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, accountRow.userId));

  const afterEpoch =
    existing?.summariesCursor ?? Math.floor(profile.athleteCreatedAt.getTime() / 1000) - 1;

  let page = 1;
  let upserted = 0;
  let maxStartEpoch = afterEpoch;
  let backfillComplete = existing?.summariesBackfillComplete ?? false;

  while (true) {
    const pageActivities = await stravaFetch<StravaListActivity[]>("/athlete/activities", {
      query: {
        after: afterEpoch,
        page,
        per_page: ACTIVITIES_PER_PAGE,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (pageActivities.length === 0) {
      backfillComplete = true;
      break;
    }

    const rows = pageActivities
      .map((activity) => mapActivity(accountRow.userId, activity, existing?.streamsSince))
      .filter((row): row is ActivityInsert => row != null);

    upserted += await batchUpsertActivities(rows);

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

  const now = new Date();
  const counts = await refreshSyncCounts(accountRow.userId);

  const [row] = await db
    .insert(activitySyncState)
    .values({
      userId: accountRow.userId,
      streamsSince: existing?.streamsSince,
      summariesBackfillComplete: backfillComplete,
      summariesCursor: maxStartEpoch,
      lastSummarySyncedAt: now,
      activitiesCount: counts.activitiesCount,
      streamsReadyCount: counts.streamsReadyCount,
      streamsPendingCount: counts.streamsPendingCount,
    })
    .onConflictDoUpdate({
      target: activitySyncState.userId,
      set: {
        summariesBackfillComplete: backfillComplete,
        summariesCursor: maxStartEpoch,
        lastSummarySyncedAt: now,
        activitiesCount: counts.activitiesCount,
        streamsReadyCount: counts.streamsReadyCount,
        streamsPendingCount: counts.streamsPendingCount,
      },
    })
    .returning();

  return row ? toSummary(row, upserted) : null;
}

export async function getActivitiesSummary(userId: string): Promise<ActivitySyncSummary | null> {
  const [row] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, userId));

  if (!row) {
    return null;
  }

  return toSummary(row, 0);
}

export async function triggerActivitySyncForUser(
  userId: string,
  options?: { force?: boolean },
): Promise<ActivitySyncSummary | null> {
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

    if (!options?.force) {
      const [existing] = await db
        .select()
        .from(activitySyncState)
        .where(eq(activitySyncState.userId, userId));

      if (
        existing?.lastSummarySyncedAt &&
        Date.now() - existing.lastSummarySyncedAt.getTime() < SYNC_COOLDOWN_MS
      ) {
        return toSummary(existing, 0);
      }
    }

    return syncAthleteActivities(stravaAccount);
  })();

  syncLocks.set(userId, run);

  try {
    return await run;
  } finally {
    syncLocks.delete(userId);
  }
}
