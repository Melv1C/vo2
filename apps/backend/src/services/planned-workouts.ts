import type {
  CreatePlannedWorkoutInput,
  PlannedWorkout,
  PlannedWorkoutSport,
  UpdatePlannedWorkoutInput,
} from "@repo/ai";
import { and, asc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/database";
import { plannedWorkouts } from "@/database/entities";
import { normalizePlannedWorkoutRange } from "@/services/planned-workouts-range";

export { normalizePlannedWorkoutRange } from "@/services/planned-workouts-range";

function toPlannedWorkout(row: typeof plannedWorkouts.$inferSelect): PlannedWorkout {
  return {
    id: row.id,
    date: row.date,
    sport: row.sport as PlannedWorkoutSport,
    durationMinutes: row.durationMinutes,
    title: row.title,
    notes: row.notes,
  };
}

export async function getPlannedWorkouts(
  userId: string,
  input: { from: string; to?: string },
): Promise<{ from: string; to: string; workouts: PlannedWorkout[] }> {
  const range = normalizePlannedWorkoutRange(input);
  const rows = await db
    .select()
    .from(plannedWorkouts)
    .where(
      and(
        eq(plannedWorkouts.userId, userId),
        gte(plannedWorkouts.date, range.from),
        lte(plannedWorkouts.date, range.to),
      ),
    )
    .orderBy(asc(plannedWorkouts.date), asc(plannedWorkouts.createdAt));

  return {
    ...range,
    workouts: rows.map(toPlannedWorkout),
  };
}

export async function createPlannedWorkout(
  userId: string,
  input: CreatePlannedWorkoutInput,
): Promise<PlannedWorkout> {
  const [row] = await db
    .insert(plannedWorkouts)
    .values({
      userId,
      date: input.date,
      sport: input.sport,
      durationMinutes: input.durationMinutes,
      title: input.title ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  if (!row) throw new Error("Planned workout was not created");
  return toPlannedWorkout(row);
}

export async function updatePlannedWorkout(
  userId: string,
  input: UpdatePlannedWorkoutInput,
): Promise<PlannedWorkout | null> {
  const { id, ...changes } = input;
  const [row] = await db
    .update(plannedWorkouts)
    .set({
      ...changes,
      updatedAt: new Date(),
    })
    .where(and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId)))
    .returning();

  return row ? toPlannedWorkout(row) : null;
}

export async function deletePlannedWorkout(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(plannedWorkouts)
    .where(and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId)))
    .returning({ id: plannedWorkouts.id });

  return deleted.length > 0;
}
