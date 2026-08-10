import { eq } from "drizzle-orm";
import { ENV } from "varlock/env";

import { db } from "@/database";
import { account } from "@/database/entities/auth";

import { stravaOAuthFetch } from "./client";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export type StravaAccount = {
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

export async function ensureValidAccessToken(accountRow: StravaAccount): Promise<string> {
  if (!accountRow.accessToken) {
    throw new Error("Missing Strava access token");
  }

  const expiresAt = accountRow.accessTokenExpiresAt?.getTime();
  if (expiresAt && expiresAt - TOKEN_EXPIRY_BUFFER_MS > Date.now()) {
    return accountRow.accessToken;
  }

  return refreshAccessToken(accountRow);
}
