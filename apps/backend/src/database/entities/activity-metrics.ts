import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  AnchorSnapshot,
  CrossCheckResult,
  DataQualityReport,
  LoadSource,
  SportFamily,
  SportPayload,
  TimeInZone,
} from "@/services/metrics/types";

import { user } from "./auth";
import { stravaActivities } from "./strava-activities";

export const activityMetrics = pgTable("activity_metrics", {
  activityId: uuid("activity_id")
    .primaryKey()
    .references(() => stravaActivities.id, { onDelete: "cascade" }),
  sportFamily: text("sport_family").$type<SportFamily>().notNull(),
  trainingLoad: doublePrecision("training_load"),
  loadSource: text("load_source").$type<LoadSource>(),
  trimpBanister: doublePrecision("trimp_banister"),
  trimpEdwards: doublePrecision("trimp_edwards"),
  hrTss: doublePrecision("hr_tss"),
  avgHr: doublePrecision("avg_hr"),
  maxHr: doublePrecision("max_hr"),
  movingTimeS: doublePrecision("moving_time_s"),
  decouplingPct: doublePrecision("decoupling_pct"),
  timeInZone: jsonb("time_in_zone").$type<TimeInZone[]>(),
  energyKcal: doublePrecision("energy_kcal"),
  weightKgUsed: doublePrecision("weight_kg_used"),
  sportPayload: jsonb("sport_payload").$type<SportPayload>(),
  dataQuality: jsonb("data_quality").$type<DataQualityReport>().notNull(),
  crossChecks: jsonb("cross_checks").$type<CrossCheckResult>(),
  anchorSnapshot: jsonb("anchor_snapshot").$type<AnchorSnapshot>().notNull(),
  metricsVersion: integer("metrics_version").notNull().default(1),
  computedAt: timestamp("computed_at").notNull(),
});

export const dailyTrainingLoad = pgTable(
  "daily_training_load",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    trainingLoad: doublePrecision("training_load").notNull().default(0),
    ctl: doublePrecision("ctl").notNull().default(0),
    atl: doublePrecision("atl").notNull().default(0),
    tsb: doublePrecision("tsb").notNull().default(0),
    isRamping: boolean("is_ramping").notNull().default(false),
    activityCount: integer("activity_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.date] })],
);

export const activityMetricsRelations = relations(activityMetrics, ({ one }) => ({
  activity: one(stravaActivities, {
    fields: [activityMetrics.activityId],
    references: [stravaActivities.id],
  }),
}));

export const dailyTrainingLoadRelations = relations(dailyTrainingLoad, ({ one }) => ({
  user: one(user, {
    fields: [dailyTrainingLoad.userId],
    references: [user.id],
  }),
}));
