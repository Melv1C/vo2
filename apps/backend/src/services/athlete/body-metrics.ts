import { and, desc, eq, lte } from "drizzle-orm";

import { db } from "@/database";
import { athleteMetricHistory, athleteProfile } from "@/database/entities/athlete-profile";

export {
  computeBmi,
  computeBsa,
  resolveWeightAtDate,
  type WeightSample,
} from "./body-metrics-core";

export async function loadWeightHistory(userId: string) {
  const rows = await db
    .select({
      value: athleteMetricHistory.value,
      recordedAt: athleteMetricHistory.recordedAt,
    })
    .from(athleteMetricHistory)
    .where(and(eq(athleteMetricHistory.userId, userId), eq(athleteMetricHistory.metric, "weight")))
    .orderBy(desc(athleteMetricHistory.recordedAt));

  return rows.map((row) => ({
    value: row.value,
    recordedAt: row.recordedAt,
  }));
}

export async function getWeightKgAtDate(userId: string, at: Date): Promise<number | null> {
  const [profile] = await db
    .select({ weightKg: athleteProfile.weightKg })
    .from(athleteProfile)
    .where(eq(athleteProfile.userId, userId));

  const [latestBefore] = await db
    .select({ value: athleteMetricHistory.value })
    .from(athleteMetricHistory)
    .where(
      and(
        eq(athleteMetricHistory.userId, userId),
        eq(athleteMetricHistory.metric, "weight"),
        lte(athleteMetricHistory.recordedAt, at),
      ),
    )
    .orderBy(desc(athleteMetricHistory.recordedAt))
    .limit(1);

  if (latestBefore) {
    return latestBefore.value;
  }

  return profile?.weightKg ?? null;
}

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
