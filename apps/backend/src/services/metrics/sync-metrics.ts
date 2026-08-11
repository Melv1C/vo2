import { logger } from "@/lib/logger";
import { computeAndPersistActivityMetrics } from "@/services/metrics/compute-activity-metrics";
import {
  loadAthleteProfile,
  loadWeightSamples,
  type AthleteContextCache,
} from "@/services/metrics/context";
import { pickEarliestDate } from "@/services/metrics/date-helpers";
import { rebuildDailyTrainingLoad } from "@/services/metrics/rebuild-daily-training-load";

export { pickEarliestDate } from "@/services/metrics/date-helpers";

export type IncrementalMetricsSummary = {
  computed: number;
  skipped: number;
  earliestDate: string | null;
};

/**
 * Computes metrics for activities whose streams just became ready.
 * Side effects: upserts `activity_metrics`, rebuilds `daily_training_load` from earliest affected date.
 */
export async function processNewlyReadyStreams(
  userId: string,
  activityIds: string[],
): Promise<IncrementalMetricsSummary> {
  const uniqueIds = [...new Set(activityIds)];
  if (uniqueIds.length === 0) {
    return { computed: 0, skipped: 0, earliestDate: null };
  }

  const athleteCache: AthleteContextCache = {
    profile: await loadAthleteProfile(userId),
    weightSamples: await loadWeightSamples(userId),
  };

  let computed = 0;
  let skipped = 0;
  const affectedDates: string[] = [];

  for (const activityId of uniqueIds) {
    const result = await computeAndPersistActivityMetrics(activityId, { athleteCache });
    if (result.computed) {
      computed += 1;
      if (result.localDate) {
        affectedDates.push(result.localDate);
      }
    } else {
      skipped += 1;
    }
  }

  const earliestDate = pickEarliestDate(affectedDates);

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
