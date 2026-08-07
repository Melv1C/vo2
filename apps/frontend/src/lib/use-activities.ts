import { useQuery } from "@tanstack/react-query";

import { activitiesQueryOptions } from "@/lib/activities-query";

export function useActivities(enabled: boolean) {
  return useQuery({
    ...activitiesQueryOptions,
    enabled,
  });
}
