import { createFetch } from "@better-fetch/fetch";

import type { DetailedAthlete } from "./types.gen";

export const stravaFetch = createFetch({
  baseURL: "https://www.strava.com/api/v3",
  throw: true,
});

export async function getLoggedInAthlete(accessToken: string) {
  return stravaFetch<DetailedAthlete>("/athlete", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
