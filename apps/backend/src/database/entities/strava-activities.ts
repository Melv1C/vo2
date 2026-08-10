import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export type StreamsStatus = "pending" | "ready" | "skipped" | "unavailable";

export const stravaActivities = pgTable(
  "strava_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stravaActivityId: text("strava_activity_id").notNull(),
    sportType: text("sport_type"),
    name: text("name"),
    startDate: timestamp("start_date").notNull(),
    startDateLocal: timestamp("start_date_local"),
    timezone: text("timezone"),
    distance: doublePrecision("distance"),
    movingTime: integer("moving_time"),
    elapsedTime: integer("elapsed_time"),
    totalElevationGain: doublePrecision("total_elevation_gain"),
    elevHigh: doublePrecision("elev_high"),
    elevLow: doublePrecision("elev_low"),
    averageSpeed: doublePrecision("average_speed"),
    maxSpeed: doublePrecision("max_speed"),
    workoutType: integer("workout_type"),
    gearId: text("gear_id"),
    averageHeartrate: doublePrecision("average_heartrate"),
    maxHeartrate: doublePrecision("max_heartrate"),
    averageCadence: doublePrecision("average_cadence"),
    averageWatts: doublePrecision("average_watts"),
    weightedAverageWatts: integer("weighted_average_watts"),
    maxWatts: integer("max_watts"),
    kilojoules: doublePrecision("kilojoules"),
    calories: doublePrecision("calories"),
    streamsStatus: text("streams_status").$type<StreamsStatus>().notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("strava_activities_user_strava_id_uidx").on(table.userId, table.stravaActivityId),
    index("strava_activities_user_start_date_idx").on(table.userId, table.startDate),
    index("strava_activities_user_streams_status_idx").on(table.userId, table.streamsStatus),
  ],
);

export const activityStreams = pgTable("activity_streams", {
  activityId: uuid("activity_id")
    .primaryKey()
    .references(() => stravaActivities.id, { onDelete: "cascade" }),
  resolution: text("resolution").$type<"low" | "medium" | "high">(),
  originalSize: integer("original_size"),
  seriesType: text("series_type").$type<"distance" | "time">(),
  timeS: doublePrecision("time_s").array(),
  distanceM: doublePrecision("distance_m").array(),
  lat: doublePrecision("lat").array(),
  lng: doublePrecision("lng").array(),
  altitudeM: doublePrecision("altitude_m").array(),
  velocityMps: doublePrecision("velocity_mps").array(),
  heartrate: doublePrecision("heartrate").array(),
  cadence: doublePrecision("cadence").array(),
  watts: doublePrecision("watts").array(),
  tempC: doublePrecision("temp_c").array(),
  moving: boolean("moving").array(),
  gradePct: doublePrecision("grade_pct").array(),
  fetchedAt: timestamp("fetched_at").notNull(),
});

export const activitySubjective = pgTable("activity_subjective", {
  activityId: uuid("activity_id")
    .primaryKey()
    .references(() => stravaActivities.id, { onDelete: "cascade" }),
  rpe: integer("rpe"),
  fatigue: integer("fatigue"),
  muscularFeel: integer("muscular_feel"),
  cardioFeel: integer("cardio_feel"),
  pain: integer("pain"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const stravaActivitiesRelations = relations(stravaActivities, ({ one }) => ({
  user: one(user, {
    fields: [stravaActivities.userId],
    references: [user.id],
  }),
  streams: one(activityStreams, {
    fields: [stravaActivities.id],
    references: [activityStreams.activityId],
  }),
  subjective: one(activitySubjective, {
    fields: [stravaActivities.id],
    references: [activitySubjective.activityId],
  }),
}));

export const activityStreamsRelations = relations(activityStreams, ({ one }) => ({
  activity: one(stravaActivities, {
    fields: [activityStreams.activityId],
    references: [stravaActivities.id],
  }),
}));

export const activitySubjectiveRelations = relations(activitySubjective, ({ one }) => ({
  activity: one(stravaActivities, {
    fields: [activitySubjective.activityId],
    references: [stravaActivities.id],
  }),
}));
