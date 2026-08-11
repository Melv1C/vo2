import { db } from "@/database";
import { athleteMetricHistory } from "@/database/entities/athlete-profile";
import { loadAthleteProfile, loadWeightSamples } from "@/services/metrics/context";

import { resolveWeightAtDate } from "./body-metrics-core";

export {
  computeBmi,
  computeBsa,
  resolveWeightAtDate,
  type WeightSample,
} from "./body-metrics-core";

/** Resolves weight at a date from history, falling back to profile weight. */
export async function getWeightKgAtDate(userId: string, at: Date): Promise<number | null> {
  const profile = await loadAthleteProfile(userId);
  const weightSamples = await loadWeightSamples(userId);
  return resolveWeightAtDate(weightSamples, profile?.weightKg ?? null, at);
}

/** Records a user-entered weight sample (append-only). */
export async function appendWeightSample(
  userId: string,
  weightKg: number,
  recordedAt: Date = new Date(),
): Promise<void> {
  await db.insert(athleteMetricHistory).values({
    userId,
    metric: "weight",
    value: weightKg,
    recordedAt,
  });
}
