import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const activitySyncState = pgTable("activity_sync_state", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** User-chosen gate: only fetch streams for activities on/after this date. */
  streamsSince: timestamp("streams_since"),
  summariesBackfillComplete: boolean("summaries_backfill_complete").notNull().default(false),
  /** Epoch seconds cursor for Strava activities list `after` param. */
  summariesCursor: integer("summaries_cursor"),
  /** Last Strava activity id considered for stream backfill. */
  streamsBackfillCursor: text("streams_backfill_cursor"),
  lastSummarySyncedAt: timestamp("last_summary_synced_at"),
  lastStreamSyncedAt: timestamp("last_stream_synced_at"),
  activitiesCount: integer("activities_count").notNull().default(0),
  streamsReadyCount: integer("streams_ready_count").notNull().default(0),
  streamsPendingCount: integer("streams_pending_count").notNull().default(0),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const activitySyncStateRelations = relations(activitySyncState, ({ one }) => ({
  user: one(user, {
    fields: [activitySyncState.userId],
    references: [user.id],
  }),
}));
