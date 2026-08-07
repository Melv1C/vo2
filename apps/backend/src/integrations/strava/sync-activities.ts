import { and, eq, sql } from "drizzle-orm";
import { ENV } from "varlock/env";

import { db } from "@/database";
import { activities } from "@/database/entities/activities";
import { account, user } from "@/database/entities/auth";

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

function toSummary(
  row: typeof activities.$inferSelect,
  newActivities: number,
): ActivitySyncSummary {
  return {
    activitiesCount: row.activitiesCount,
    lastFetchedAt: row.lastFetchedAt.toISOString(),
    newActivities,
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

async function fetchActivitiesSince(accessToken: string, afterEpoch: number): Promise<number> {
  let page = 1;
  let total = 0;

  while (true) {
    const pageActivities = await stravaFetch<SummaryActivity[]>("/athlete/activities", {
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
      break;
    }

    total += pageActivities.length;
    page++;
  }

  return total;
}

async function syncAthleteActivities(
  accountRow: StravaAccount,
): Promise<ActivitySyncSummary | null> {
  const accessToken = await ensureValidAccessToken(accountRow);

  const [userRow] = await db.select().from(user).where(eq(user.id, accountRow.userId));
  if (!userRow?.athleteCreatedAt) {
    console.warn(`[strava-sync] user=${accountRow.userId} missing athleteCreatedAt, skipping`);
    return null;
  }

  const [existing] = await db
    .select()
    .from(activities)
    .where(eq(activities.userId, accountRow.userId));

  const afterDate = existing?.lastFetchedAt ?? userRow.athleteCreatedAt;
  const afterEpoch = Math.floor(afterDate.getTime() / 1000);
  const newActivities = await fetchActivitiesSince(accessToken, afterEpoch);
  const now = new Date();

  const [row] = await db
    .insert(activities)
    .values({
      userId: accountRow.userId,
      activitiesCount: newActivities,
      lastFetchedAt: now,
    })
    .onConflictDoUpdate({
      target: activities.userId,
      set: {
        activitiesCount: sql`${activities.activitiesCount} + ${newActivities}`,
        lastFetchedAt: now,
      },
    })
    .returning();

  return row ? toSummary(row, newActivities) : null;
}

export async function getActivitiesSummary(userId: string): Promise<ActivitySyncSummary | null> {
  const [row] = await db.select().from(activities).where(eq(activities.userId, userId));

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
      const [existing] = await db.select().from(activities).where(eq(activities.userId, userId));

      if (existing && Date.now() - existing.lastFetchedAt.getTime() < SYNC_COOLDOWN_MS) {
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
