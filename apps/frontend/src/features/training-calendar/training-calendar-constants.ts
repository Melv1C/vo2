import type { PlannedWorkout, PlannedWorkoutSport } from "@repo/ai";

import type { CalendarActivity } from "@/lib/activities-api";

export const sportOptions: Array<{ value: PlannedWorkoutSport; label: string }> = [
  { value: "cycling", label: "Cycling" },
  { value: "running", label: "Running" },
  { value: "swimming", label: "Swimming" },
  { value: "walking", label: "Walking" },
  { value: "strength", label: "Strength" },
  { value: "mobility", label: "Mobility" },
  { value: "other", label: "Other" },
];

export const sportLabels = Object.fromEntries(
  sportOptions.map((sport) => [sport.value, sport.label]),
) as Record<PlannedWorkoutSport, string>;

export const emptyWorkouts: PlannedWorkout[] = [];
export const emptyActivities: CalendarActivity[] = [];
