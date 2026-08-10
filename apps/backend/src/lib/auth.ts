import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, genericOAuth } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";
import { ENV } from "varlock/env";

import { db, dbWithoutLogging } from "@/database";
import { athleteProfile } from "@/database/entities/athlete-profile";
import * as schema from "@/database/entities/auth";
import type { DetailedAthlete } from "@/integrations/strava";
import { stravaFetch } from "@/integrations/strava/client";
import { triggerActivitySyncForUser } from "@/integrations/strava/sync-activities";
import { logger } from "@/lib/logger";

async function upsertAthleteProfileFromStrava(userId: string, accessToken: string) {
  const athlete = await stravaFetch<DetailedAthlete>("/athlete", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  await db
    .insert(athleteProfile)
    .values({
      userId,
      athleteCreatedAt: athlete.created_at ? new Date(athlete.created_at) : undefined,
      sex: athlete.sex ?? null,
    })
    .onConflictDoUpdate({
      target: athleteProfile.userId,
      set: {
        athleteCreatedAt: athlete.created_at ? new Date(athlete.created_at) : undefined,
        sex: athlete.sex ?? null,
      },
    });
}

export const auth = betterAuth({
  database: drizzleAdapter(dbWithoutLogging, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins: [ENV.FRONTEND_URL],
  plugins: [
    admin(),
    genericOAuth({
      config: [
        {
          providerId: "strava",
          clientId: ENV.STRAVA_CLIENT_ID,
          clientSecret: ENV.STRAVA_CLIENT_SECRET,
          authorizationUrl: "https://www.strava.com/oauth/authorize",
          tokenUrl: "https://www.strava.com/oauth/token",
          scopes: ["read", "read_all", "profile:read_all", "activity:read", "activity:read_all"],

          mapProfileToUser: (profile) => {
            return {
              name: profile.name,
              email: profile.email,
              image: profile.image,
              emailVerified: profile.emailVerified,
            };
          },

          getUserInfo: async (tokens) => {
            if (!tokens.accessToken) {
              throw new Error("Missing Strava access token");
            }

            const athlete = await stravaFetch<DetailedAthlete>("/athlete", {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });

            return {
              id: athlete.id!.toString(),
              name: `${athlete.firstname} ${athlete.lastname}`,
              email: `${athlete.id}@strava.local`,
              image: athlete.profile,
              emailVerified: false,
            };
          },
        },
      ],
    }),
  ],
  databaseHooks: {
    account: {
      create: {
        after: async (account) => {
          if (account.providerId !== "strava" || !account.accessToken) {
            return;
          }

          try {
            await upsertAthleteProfileFromStrava(account.userId, account.accessToken);
          } catch (error) {
            logger.error("[strava-profile] failed", { userId: account.userId, error });
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          const [profile] = await db
            .select()
            .from(athleteProfile)
            .where(eq(athleteProfile.userId, session.userId));

          if (!profile) {
            const [stravaAccount] = await db
              .select()
              .from(schema.account)
              .where(
                and(
                  eq(schema.account.userId, session.userId),
                  eq(schema.account.providerId, "strava"),
                ),
              );

            if (stravaAccount?.accessToken) {
              try {
                await upsertAthleteProfileFromStrava(session.userId, stravaAccount.accessToken);
              } catch (error) {
                logger.error("[strava-profile] failed", { userId: session.userId, error });
              }
            }
          }

          void triggerActivitySyncForUser(session.userId).catch((error) => {
            logger.error("[strava-sync] failed", { userId: session.userId, error });
          });
        },
      },
    },
  },
});
