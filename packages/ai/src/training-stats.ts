import { toolDefinition } from "@tanstack/ai";
import * as z from "zod";

export const trainingStatsInputSchema$ = z.object({
  from: z.iso.date().optional().meta({ description: "Inclusive start date in YYYY-MM-DD format" }),
  to: z.iso.date().optional().meta({ description: "Inclusive end date in YYYY-MM-DD format" }),
  sportFamily: z
    .enum(["cycling", "running", "swimming", "walking", "other"])
    .optional()
    .meta({ description: "Optional sport family filter" }),
  activityId: z.string().trim().optional().meta({ description: "Optional activity identifier" }),
});

export const trainingStatsOutputSchema$ = z.object({
  range: z.object({
    from: z.string().trim().nullable(),
    to: z.string().trim().nullable(),
  }),
  summary: z.object({
    activityCount: z.number(),
    trainingLoad: z.number(),
    averageDailyLoad: z.number(),
    ctl: z.number().nullable(),
    atl: z.number().nullable(),
    tsb: z.number().nullable(),
    sports: z.array(
      z.object({
        sportFamily: z.string().trim(),
        activityCount: z.number(),
        trainingLoad: z.number(),
        movingTimeMinutes: z.number(),
      }),
    ),
  }),
  daily: z.array(
    z.object({
      date: z.string().trim(),
      trainingLoad: z.number(),
      ctl: z.number(),
      atl: z.number(),
      tsb: z.number(),
      activityCount: z.number(),
    }),
  ),
  activities: z.array(
    z.object({
      id: z.string().trim(),
      name: z.string().trim().nullable(),
      sportFamily: z.string().trim(),
      sportType: z.string().trim().nullable(),
      date: z.string().trim(),
      movingTimeMinutes: z.number().nullable(),
      distanceKm: z.number().nullable(),
      trainingLoad: z.number().nullable(),
      averageHeartRate: z.number().nullable(),
      averageWatts: z.number().nullable(),
      dataQuality: z
        .object({
          coveragePct: z.number(),
          downgraded: z.boolean(),
        })
        .nullable(),
    }),
  ),
  athlete: z.object({
    weightKg: z.number().nullable(),
    restingHr: z.number().nullable(),
    maxHr: z.number().nullable(),
    lthr: z.number().nullable(),
    ftp: z.number().nullable(),
    thresholdPaceMps: z.number().nullable(),
    thresholdSwimPaceMps: z.number().nullable(),
  }),
  dataQuality: z.object({
    streamsPendingCount: z.number(),
    streamsReadyCount: z.number(),
    activitiesWithMetrics: z.number(),
  }),
  notes: z.array(z.string().trim()),
});

export const trainingStatsToolDefinition = toolDefinition({
  name: "get_training_stats",
  description:
    "Read the authenticated athlete's computed training statistics. Use it for trend, load, fatigue, freshness, activity, sport mix, and data-quality questions. Never infer a user ID. Filters are optional and must use bounded dates.",
  inputSchema: trainingStatsInputSchema$,
  outputSchema: trainingStatsOutputSchema$,
});

export type TrainingStatsInput = z.infer<typeof trainingStatsInputSchema$>;
export type TrainingStatsOutput = z.infer<typeof trainingStatsOutputSchema$>;
