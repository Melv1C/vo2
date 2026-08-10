import { eq, sql } from "drizzle-orm";

import { db } from "@/database";
import { stravaActivities } from "@/database/entities/strava-activities";
import { logger } from "@/lib/logger";
import { computeAndPersistActivityMetrics } from "@/services/metrics/compute-activity-metrics";
import { rebuildDailyTrainingLoad } from "@/services/metrics/rebuild-daily-training-load";

const activityLocalDate = sql<string>`coalesce(date(${stravaActivities.startDateLocal}), date(${stravaActivities.startDate}))`;

async function getActivityLocalDate(activityId: string): Promise<string | null> {
  const [row] = await db
    .select({
      date: activityLocalDate,
    })
    .from(stravaActivities)
    .where(eq(stravaActivities.id, activityId));

  return row?.date ?? null;
}

export type IncrementalMetricsSummary = {
  computed: number;
  skipped: number;
  earliestDate: string | null;
};

export async function processNewlyReadyStreams(
  userId: string,
  activityIds: string[],
): Promise<IncrementalMetricsSummary> {
  const uniqueIds = [...new Set(activityIds)];
  if (uniqueIds.length === 0) {
    return { computed: 0, skipped: 0, earliestDate: null };
  }

  let computed = 0;
  let skipped = 0;
  const affectedDates: string[] = [];

  for (const activityId of uniqueIds) {
    const result = await computeAndPersistActivityMetrics(activityId);
    if (result.computed) {
      computed += 1;
      const date = await getActivityLocalDate(activityId);
      if (date) {
        affectedDates.push(date);
      }
    } else {
      skipped += 1;
    }
  }

  const earliestDate =
    affectedDates.length > 0 ? affectedDates.sort((left, right) => left.localeCompare(right))[0]! : null;

  if (earliestDate) {
    await rebuildDailyTrainingLoad(userId, earliestDate);
  }

  logger.info("[metrics-sync] incremental compute complete", {
    userId,
    computed,
    skipped,
    earliestDate,
  });

  return { computed, skipped, earliestDate };
}
