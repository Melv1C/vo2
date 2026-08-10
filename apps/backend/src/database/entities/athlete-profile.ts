import { relations } from "drizzle-orm";
import {
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const athleteProfile = pgTable("athlete_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Seeded from Strava athlete.created_at at connect time. */
  athleteCreatedAt: timestamp("athlete_created_at"),
  /** Seeded from Strava; only Strava-sourced profile field. */
  sex: text("sex"),
  birthdate: date("birthdate"),
  heightCm: doublePrecision("height_cm"),
  weightKg: doublePrecision("weight_kg"),
  restingHr: integer("resting_hr"),
  maxHr: integer("max_hr"),
  lthr: integer("lthr"),
  ftp: integer("ftp"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type AthleteZoneType = "hr" | "power" | "pace";

export type AthleteZoneRange = {
  min: number;
  max: number;
};

export const athleteZones = pgTable(
  "athlete_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").$type<AthleteZoneType>().notNull(),
    zones: jsonb("zones").$type<AthleteZoneRange[]>().notNull().default([]),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("athlete_zones_user_type_uidx").on(table.userId, table.type)],
);

export type AthleteMetric = "weight" | "ftp" | "resting_hr" | "max_hr" | "lthr" | "height";

/** Append-only user-entered metric samples (never sourced from Strava). */
export const athleteMetricHistory = pgTable("athlete_metric_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  metric: text("metric").$type<AthleteMetric>().notNull(),
  value: doublePrecision("value").notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const athleteProfileRelations = relations(athleteProfile, ({ one }) => ({
  user: one(user, {
    fields: [athleteProfile.userId],
    references: [user.id],
  }),
}));

export const athleteZonesRelations = relations(athleteZones, ({ one }) => ({
  user: one(user, {
    fields: [athleteZones.userId],
    references: [user.id],
  }),
}));

export const athleteMetricHistoryRelations = relations(athleteMetricHistory, ({ one }) => ({
  user: one(user, {
    fields: [athleteMetricHistory.userId],
    references: [user.id],
  }),
}));
