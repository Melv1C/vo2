import { BetterFetchError, createFetch } from "@better-fetch/fetch";

import { getSharedRateLimiter, type StravaRateLimiter } from "./rate-limit";

export const stravaFetch = createFetch({
  baseURL: "https://www.strava.com/api/v3",
  throw: true,
  onResponse: (context) => {
    getSharedRateLimiter().updateFromHeaders(context.response.headers);
  },
});

export const stravaOAuthFetch = createFetch({
  baseURL: "https://www.strava.com",
  throw: true,
});

type StravaRequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  limiter?: StravaRateLimiter;
};

/** Rate-limit-aware Strava API read built on stravaFetch. */
export async function stravaRequest<T>(
  path: string,
  options: StravaRequestOptions = {},
): Promise<T> {
  const { query, headers, limiter = getSharedRateLimiter() } = options;

  await limiter.acquire();

  return stravaFetch<T>(path, { query, headers });
}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof BetterFetchError && error.status === 429;
}
