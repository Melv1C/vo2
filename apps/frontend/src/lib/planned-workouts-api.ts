import type {
  CreatePlannedWorkoutInput,
  PlannedWorkout,
  UpdatePlannedWorkoutInput,
} from "@repo/ai";
import type { InferResponseType } from "hono/client";

import { apiClient } from "@/lib/api-client";

export type { PlannedWorkout };

type PlannedWorkoutsResponse = InferResponseType<
  (typeof apiClient)["planned-workouts"]["$get"],
  200
>;

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
  return response.json();
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
