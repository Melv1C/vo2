import { ENV } from "varlock/env";

export type ActivitySyncSummary = {
  activitiesCount: number;
  lastFetchedAt: string | null;
  newActivities: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ENV.BACKEND_URL}/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchActivities(): Promise<ActivitySyncSummary> {
  return request<ActivitySyncSummary>("/activities");
}

export function syncActivities(): Promise<ActivitySyncSummary> {
  return request<ActivitySyncSummary>("/activities/sync", { method: "POST" });
}
