import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const activities = pgTable("activities", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  activitiesCount: integer("activities_count").notNull().default(0),
  lastFetchedAt: timestamp("last_fetched_at").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(user, {
    fields: [activities.userId],
    references: [user.id],
  }),
}));
