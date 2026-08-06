import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, genericOAuth } from "better-auth/plugins";
import { ENV } from "varlock/env";

import { db } from "@/database";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
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
              email: "",
              image: profile.image,
              emailVerified: profile.emailVerified,
            };
          },

          getUserInfo: async (tokens) => {
            const res = await fetch("https://www.strava.com/api/v3/athlete", {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });

            const athlete = (await res.json()) as any;

            return {
              id: athlete.id.toString(),
              name: `${athlete.firstname} ${athlete.lastname}`,
              image: athlete.profile,
              emailVerified: false,
            };
          },
        },
      ],
    }),
  ],
});
