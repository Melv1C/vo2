import { and, desc, eq } from "drizzle-orm";

import { db } from "@/database";
import { athleteMetricHistory, athleteProfile } from "@/database/entities/athlete-profile";
import { resolveWeightAtDate, type WeightSample } from "@/services/athlete/body-metrics-core";
import type { AthleteContext, AthleteSex } from "@/services/metrics/types";

function parseSex(value: string | null): AthleteSex | null {
  if (value === "M" || value === "F") {
    return value;
  }
  return null;
}

export type AthleteContextCache = {
  profile: typeof athleteProfile.$inferSelect | null;
  weightSamples: WeightSample[];
};

/** Loads athlete profile row without weight resolution. */
export async function loadAthleteProfile(
  userId: string,
): Promise<typeof athleteProfile.$inferSelect | null> {
  const [profile] = await db.select().from(athleteProfile).where(eq(athleteProfile.userId, userId));
  return profile ?? null;
}

/** Loads append-only weight history for batch metrics computation. */
export async function loadWeightSamples(userId: string): Promise<WeightSample[]> {
  const rows = await db
    .select({
      value: athleteMetricHistory.value,
      recordedAt: athleteMetricHistory.recordedAt,
    })
    .from(athleteMetricHistory)
    .where(and(eq(athleteMetricHistory.userId, userId), eq(athleteMetricHistory.metric, "weight")))
    .orderBy(desc(athleteMetricHistory.recordedAt));

  return rows;
}

/**
 * Builds athlete context from cached profile and weight samples.
 * Resolves weight at `at` via history, falling back to profile weight.
 */
export function buildAthleteContext(
  userId: string,
  at: Date,
  profile: typeof athleteProfile.$inferSelect | null,
  weightSamples: WeightSample[],
): AthleteContext {
  return {
    userId,
    maxHr: profile?.maxHr ?? null,
    restingHr: profile?.restingHr ?? null,
    lthr: profile?.lthr ?? null,
    ftp: profile?.ftp ?? null,
    thresholdPaceMps: profile?.thresholdPaceMps ?? null,
    thresholdSwimPaceMps: profile?.thresholdSwimPaceMps ?? null,
    weightKg: resolveWeightAtDate(weightSamples, profile?.weightKg ?? null, at),
    heightCm: profile?.heightCm ?? null,
    birthdate: profile?.birthdate ?? null,
    sex: parseSex(profile?.sex ?? null),
  };
}

/**
 * Loads full athlete context for metrics computation at a point in time.
 * When `cache` is provided, skips DB reads (used during batch sync).
 */
export async function loadAthleteContext(
  userId: string,
  at: Date = new Date(),
  cache?: AthleteContextCache,
): Promise<AthleteContext> {
  if (cache) {
    return buildAthleteContext(userId, at, cache.profile, cache.weightSamples);
  }

  const profile = await loadAthleteProfile(userId);
  const weightSamples = await loadWeightSamples(userId);
  return buildAthleteContext(userId, at, profile, weightSamples);
}
