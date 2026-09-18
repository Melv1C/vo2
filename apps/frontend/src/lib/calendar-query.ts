import { queryOptions } from "@tanstack/react-query";

import { fetchCalendarActivities } from "@/lib/activities-api";

export const calendarActivitiesQueryKey = ["calendar-activities"] as const;

export function calendarActivitiesQueryOptions(from: string, to: string) {
  return queryOptions({
    queryKey: [...calendarActivitiesQueryKey, from, to] as const,
    queryFn: ({ signal }) => fetchCalendarActivities(from, to, signal),
  });
}
