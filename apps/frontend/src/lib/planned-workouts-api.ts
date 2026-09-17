import type {
  CreatePlannedWorkoutInput,
  PlannedWorkout,
  UpdatePlannedWorkoutInput,
} from "@repo/ai";

import { apiClient } from "@/lib/api-client";

export type { PlannedWorkout };

type PlannedWorkoutsResponse = {
  from: string;
  to: string;
  workouts: PlannedWorkout[];
};

export async function fetchPlannedWorkouts(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<PlannedWorkoutsResponse> {
  const response = await apiClient["planned-workouts"].$get(
    { query: { from, to } },
    { init: { signal } },
  );
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<PlannedWorkoutsResponse>;
}

export async function createPlannedWorkout(input: CreatePlannedWorkoutInput) {
  const response = await apiClient["planned-workouts"].$post({ json: input });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function updatePlannedWorkout(input: UpdatePlannedWorkoutInput) {
  const { id, ...changes } = input;
  const response = await apiClient["planned-workouts"][id].$patch({ json: changes });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

export async function deletePlannedWorkout(id: string) {
  const response = await apiClient["planned-workouts"][id].$delete();
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
