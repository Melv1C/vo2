import {
  createPlannedWorkoutToolDefinition,
  deletePlannedWorkoutToolDefinition,
  listPlannedWorkoutsToolDefinition,
  updatePlannedWorkoutToolDefinition,
} from "@repo/ai";

import {
  createPlannedWorkout,
  deletePlannedWorkout,
  getPlannedWorkouts,
  updatePlannedWorkout,
} from "@/services/planned-workouts";

export type PlannedWorkoutsToolContext = {
  userId: string;
};

export const listPlannedWorkoutsTool =
  listPlannedWorkoutsToolDefinition.server<PlannedWorkoutsToolContext>(async (input, { context }) =>
    getPlannedWorkouts(context.userId, input),
  );

export const createPlannedWorkoutTool =
  createPlannedWorkoutToolDefinition.server<PlannedWorkoutsToolContext>(
    async (input, { context }) => ({
      workout: await createPlannedWorkout(context.userId, input),
    }),
  );

export const updatePlannedWorkoutTool =
  updatePlannedWorkoutToolDefinition.server<PlannedWorkoutsToolContext>(
    async (input, { context }) => {
      const workout = await updatePlannedWorkout(context.userId, input);
      if (!workout) throw new Error("Planned workout not found");
      return { workout };
    },
  );

export const deletePlannedWorkoutTool =
  deletePlannedWorkoutToolDefinition.server<PlannedWorkoutsToolContext>(
    async (input, { context }) => {
      const deleted = await deletePlannedWorkout(context.userId, input.id);
      if (!deleted) throw new Error("Planned workout not found");
      return { id: input.id, deleted: true };
    },
  );
