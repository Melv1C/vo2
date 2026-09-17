import { toolDefinition } from "@tanstack/ai";
import * as z from "zod";

export const plannedWorkoutSport$ = z.enum([
  "cycling",
  "running",
  "swimming",
  "walking",
  "strength",
  "mobility",
  "other",
]);

export const plannedWorkout$ = z.object({
  id: z.string().trim(),
  date: z.iso.date(),
  sport: plannedWorkoutSport$,
  durationMinutes: z.int().min(1).max(1_440),
  title: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

export const listPlannedWorkoutsInputSchema$ = z.object({
  from: z.iso.date().optional().meta({ description: "Inclusive start date in YYYY-MM-DD format" }),
  to: z.iso.date().optional().meta({ description: "Inclusive end date in YYYY-MM-DD format" }),
});

export const listPlannedWorkoutsOutputSchema$ = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  workouts: z.array(plannedWorkout$),
});

export const createPlannedWorkoutInputSchema$ = z.object({
  date: z.iso.date().meta({ description: "Calendar date in YYYY-MM-DD format" }),
  sport: plannedWorkoutSport$,
  durationMinutes: z.int().min(1).max(1_440),
  title: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

export const createPlannedWorkoutOutputSchema$ = z.object({
  workout: plannedWorkout$,
});

export const updatePlannedWorkoutInputSchema$ = z
  .object({
    id: z.string().trim().min(1),
    date: z.iso.date().optional(),
    sport: plannedWorkoutSport$.optional(),
    durationMinutes: z.int().min(1).max(1_440).optional(),
    title: z.string().trim().max(200).nullish(),
    notes: z.string().trim().max(2_000).nullish(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "id"), {
    error: "At least one workout field must be updated",
  });

export const updatePlannedWorkoutOutputSchema$ = z.object({
  workout: plannedWorkout$,
});

export const deletePlannedWorkoutInputSchema$ = z.object({
  id: z.string().trim().min(1),
});

export const deletePlannedWorkoutOutputSchema$ = z.object({
  id: z.string().trim(),
  deleted: z.boolean(),
});

export const listPlannedWorkoutsToolDefinition = toolDefinition({
  name: "list_planned_workouts",
  description:
    "Read the authenticated athlete's planned workouts for a date range. Use this when answering questions about the training plan or upcoming sessions.",
  inputSchema: listPlannedWorkoutsInputSchema$,
  outputSchema: listPlannedWorkoutsOutputSchema$,
});

export const createPlannedWorkoutToolDefinition = toolDefinition({
  name: "create_planned_workout",
  description:
    "Create one planned workout for the authenticated athlete. Ask for a duration when it is missing. This action requires the athlete's explicit approval.",
  needsApproval: true,
  inputSchema: createPlannedWorkoutInputSchema$,
  outputSchema: createPlannedWorkoutOutputSchema$,
});

export const updatePlannedWorkoutToolDefinition = toolDefinition({
  name: "update_planned_workout",
  description:
    "Update an existing planned workout by ID. Read the plan first when the ID is not known. This action requires the athlete's explicit approval.",
  needsApproval: true,
  inputSchema: updatePlannedWorkoutInputSchema$,
  outputSchema: updatePlannedWorkoutOutputSchema$,
});

export const deletePlannedWorkoutToolDefinition = toolDefinition({
  name: "delete_planned_workout",
  description:
    "Delete an existing planned workout by ID. Read the plan first when the ID is not known. This action requires the athlete's explicit approval.",
  needsApproval: true,
  inputSchema: deletePlannedWorkoutInputSchema$,
  outputSchema: deletePlannedWorkoutOutputSchema$,
});

export type PlannedWorkout = z.infer<typeof plannedWorkout$>;
export type PlannedWorkoutSport = z.infer<typeof plannedWorkoutSport$>;
export type ListPlannedWorkoutsInput = z.infer<typeof listPlannedWorkoutsInputSchema$>;
export type ListPlannedWorkoutsOutput = z.infer<typeof listPlannedWorkoutsOutputSchema$>;
export type CreatePlannedWorkoutInput = z.infer<typeof createPlannedWorkoutInputSchema$>;
export type CreatePlannedWorkoutOutput = z.infer<typeof createPlannedWorkoutOutputSchema$>;
export type UpdatePlannedWorkoutInput = z.infer<typeof updatePlannedWorkoutInputSchema$>;
export type UpdatePlannedWorkoutOutput = z.infer<typeof updatePlannedWorkoutOutputSchema$>;
export type DeletePlannedWorkoutInput = z.infer<typeof deletePlannedWorkoutInputSchema$>;
export type DeletePlannedWorkoutOutput = z.infer<typeof deletePlannedWorkoutOutputSchema$>;
