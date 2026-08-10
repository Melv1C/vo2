import * as z from "zod";

export const recomputeMetricsQuery$ = z.object({
  scope: z.literal("all").optional().default("all"),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type RecomputeMetricsQuery = z.infer<typeof recomputeMetricsQuery$>;

export const timeInZone$ = z.object({
  zone: z.number().int(),
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

export const sportPayload$ = z.union([cyclingPayload$, runningPayload$]);

export const anchorSnapshot$ = z.object({
  maxHr: z.number().nullable(),
  restingHr: z.number().nullable(),
  lthr: z.number().nullable(),
  ftp: z.number().nullable(),
  thresholdPaceMps: z.number().nullable(),
  weightKg: z.number().nullable(),
  sex: z.enum(["M", "F"]).nullable(),
});

export const activityMetricsResponse$ = z.object({
  activityId: z.uuid(),
  sportFamily: z.enum(["cycling", "running", "walking", "other"]),
  trimpBanister: z.number().nullable(),
  trimpEdwards: z.number().nullable(),
  hrTss: z.number().nullable(),
  avgHr: z.number().nullable(),
  maxHr: z.number().nullable(),
  movingTimeS: z.number(),
  decouplingPct: z.number().nullable(),
  timeInZone: z.array(timeInZone$),
  energyKcal: z.number().nullable(),
  weightKgUsed: z.number().nullable(),
  sportPayload: sportPayload$.nullable(),
  dataQuality: dataQualityReport$,
  anchorSnapshot: anchorSnapshot$,
  metricsVersion: z.number().int(),
  computedAt: z.string(),
});

export type ActivityMetricsResponse = z.infer<typeof activityMetricsResponse$>;

export const recomputeMetricsResponse$ = z.object({
  processed: z.number().int(),
  skipped: z.number().int(),
});

export type RecomputeMetricsResponse = z.infer<typeof recomputeMetricsResponse$>;
