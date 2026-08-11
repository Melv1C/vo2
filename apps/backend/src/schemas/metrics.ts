import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";

import { activityMetrics, dailyTrainingLoad } from "@/database/entities/activity-metrics";

export const crossCheckResult$ = z.object({
  tssVsHrtssPct: z.number().nullable(),
  rtssVsHrtssPct: z.number().nullable(),
  stssVsHrtssPct: z.number().nullable(),
  banisterVsEdwardsPct: z.number().nullable(),
  decouplingSanity: z.boolean(),
  coverageOk: z.boolean(),
  downgraded: z.boolean(),
});

export const dailyMetricsQuery$ = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const recomputeMetricsQuery$ = z.object({
  scope: z.enum(["all", "stale"]).default("all"),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const timeInZone$ = z.object({
  zone: z.int(),
  seconds: z.number(),
});

export const dataQualityReport$ = z.object({
  samplesIn: z.number(),
  samplesDropped: z.number(),
  segments: z.number(),
  longestGapS: z.number(),
  nominalDtS: z.number(),
  coveragePct: z.number(),
  movingTimeS: z.number(),
});

export const cyclingPayload$ = z.object({
  np: z.number(),
  intensityFactor: z.number(),
  tss: z.number(),
  variabilityIndex: z.number(),
  workKj: z.number(),
  wattsPerKg: z.number(),
});

export const runningPayload$ = z.object({
  ngpMps: z.number(),
  runIntensityFactor: z.number(),
  rTss: z.number(),
  efficiencyIndex: z.number(),
  avgCadence: z.number().nullable(),
});

export const swimmingPayload$ = z.object({
  nspMps: z.number(),
  swimIntensityFactor: z.number(),
  sTss: z.number(),
  efficiencyIndex: z.number(),
  avgCadence: z.number().nullable(),
});

export const sportPayload$ = z.union([cyclingPayload$, runningPayload$, swimmingPayload$]);

export const anchorSnapshot$ = z.object({
  maxHr: z.number().nullable(),
  restingHr: z.number().nullable(),
  lthr: z.number().nullable(),
  ftp: z.number().nullable(),
  thresholdPaceMps: z.number().nullable(),
  thresholdSwimPaceMps: z.number().nullable(),
  weightKg: z.number().nullable(),
  sex: z.enum(["M", "F"]).nullable(),
});

const activityMetricsRow$ = createSelectSchema(activityMetrics, {
  sportFamily: z.enum(["cycling", "running", "swimming", "walking", "other"]),
  loadSource: z.enum(["tss", "r_tss", "s_tss", "hr_tss", "trimp_equiv"]).nullable(),
  timeInZone: z.array(timeInZone$).nullable(),
  sportPayload: sportPayload$.nullable(),
  crossChecks: crossCheckResult$.nullable(),
  dataQuality: dataQualityReport$,
  anchorSnapshot: anchorSnapshot$,
});

/** API response for GET /activities/:id/metrics — derived from activity_metrics via drizzle-zod. */
export const activityMetricsResponse$ = activityMetricsRow$.transform((row) => ({
  ...row,
  computedAt: row.computedAt.toISOString(),
  timeInZone: row.timeInZone ?? [],
}));

export type ActivityMetricsResponse = z.infer<typeof activityMetricsResponse$>;

/** Daily CTL/ATL/TSB point — derived from daily_training_load, userId omitted. */
export const dailyTrainingLoadPoint$ = createSelectSchema(dailyTrainingLoad).omit({ userId: true });

export const dailyTrainingLoadSeriesResponse$ = z.object({
  series: z.array(dailyTrainingLoadPoint$),
});

export const recomputeMetricsResponse$ = z.object({
  processed: z.int(),
  skipped: z.int(),
});
