import { queryOptions } from "@tanstack/react-query";

import { fetchActivities } from "@/lib/activities-api";

export const activitiesQueryKey = ["activities"] as const;

export const activitiesQueryOptions = queryOptions({
  queryKey: activitiesQueryKey,
  queryFn: ({ signal }) => fetchActivities(signal),
});
