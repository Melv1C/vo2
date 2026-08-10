import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, genericOAuth } from "better-auth/plugins";
import { ENV } from "varlock/env";

import { dbWithoutLogging } from "@/database";
import * as schema from "@/database/entities/auth";
import type { DetailedAthlete } from "@/integrations/strava";
import { stravaFetch } from "@/integrations/strava/client";
import { triggerActivitySyncForUser } from "@/integrations/strava/sync-activities";
import { logger } from "@/lib/logger";

export const auth = betterAuth({
  database: drizzleAdapter(dbWithoutLogging, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins: [ENV.FRONTEND_URL],
  user: {
    additionalFields: {
      athleteCreatedAt: { type: "date", required: false, input: true },
      sex: { type: "string", required: false, input: true },
    },
  },
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
              athleteCreatedAt: profile.athleteCreatedAt,
              sex: profile.sex,
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
              athleteCreatedAt: athlete.created_at ? new Date(athlete.created_at) : undefined,
              sex: athlete.sex,
            };
          },
        },
      ],
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          void triggerActivitySyncForUser(session.userId).catch((err) => {
            logger.error(`[strava-sync] failed for user=${session.userId}`, err);
          });
        },
      },
    },
  },
});
