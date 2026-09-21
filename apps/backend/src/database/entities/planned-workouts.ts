import { relations } from "drizzle-orm";
import { date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

export type PlannedWorkoutSport =
  | "cycling"
  | "running"
  | "swimming"
  | "walking"
  | "strength"
  | "mobility"
  | "other";

export const plannedWorkouts = pgTable(
  "planned_workouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    sport: text("sport").$type<PlannedWorkoutSport>().notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    title: text("title"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("planned_workouts_user_date_idx").on(table.userId, table.date)],
);

export const plannedWorkoutsRelations = relations(plannedWorkouts, ({ one }) => ({
  user: one(user, {
    fields: [plannedWorkouts.userId],
    references: [user.id],
  }),
}));
