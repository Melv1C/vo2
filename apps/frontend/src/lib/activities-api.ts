import type { InferResponseType } from "hono/client";

import { apiClient } from "@/lib/api-client";

export type ActivitySyncSummary = InferResponseType<typeof apiClient.activities.$get>;

export async function fetchActivities(signal?: AbortSignal) {
  const res = await apiClient.activities.$get(undefined, { init: { signal } });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

type CalendarActivitiesResponse = InferResponseType<typeof apiClient.calendar.$get, 200>;
export type CalendarActivity = CalendarActivitiesResponse["activities"][number];

export async function fetchCalendarActivities(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<CalendarActivitiesResponse> {
  const response = await apiClient.calendar.$get({ query: { from, to } }, { init: { signal } });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
