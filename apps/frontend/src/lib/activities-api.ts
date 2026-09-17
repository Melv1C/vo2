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

export type CalendarActivity = {
  id: string;
  date: string;
  name: string | null;
  sportFamily: string | null;
  sportType: string | null;
  durationMinutes: number;
};

export async function fetchCalendarActivities(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ activities: CalendarActivity[] }> {
  const response = await apiClient.activities.calendar.$get(
    { query: { from, to } },
    { init: { signal } },
  );
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<{ activities: CalendarActivity[] }>;
}
