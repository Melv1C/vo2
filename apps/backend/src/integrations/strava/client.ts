import { createFetch } from "@better-fetch/fetch";

export const stravaFetch = createFetch({
  baseURL: "https://www.strava.com/api/v3",
  throw: true,
});
