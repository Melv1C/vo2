import { createFetch } from "@better-fetch/fetch";
import { ENV } from "varlock/env";

export type ActivitySyncSummary = {
  activitiesCount: number;
  lastFetchedAt: string | null;
  newActivities: number;
};

const api = createFetch({
  baseURL: `${ENV.BACKEND_URL}/api`,
  credentials: "include",
  throw: true,
});

export const fetchActivities = (signal?: AbortSignal) =>
  api<ActivitySyncSummary>("/activities", { signal });
