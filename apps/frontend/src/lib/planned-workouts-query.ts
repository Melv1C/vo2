import { queryOptions } from "@tanstack/react-query";

import { fetchPlannedWorkouts } from "@/lib/planned-workouts-api";

export const plannedWorkoutsQueryKey = ["planned-workouts"] as const;

export function plannedWorkoutsQueryOptions(from: string, to: string) {
  return queryOptions({
    queryKey: [...plannedWorkoutsQueryKey, from, to] as const,
    queryFn: ({ signal }) => fetchPlannedWorkouts(from, to, signal),
  });
}
