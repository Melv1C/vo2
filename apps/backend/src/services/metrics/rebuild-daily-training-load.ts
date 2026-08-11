import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/database";
import { activityMetrics, dailyTrainingLoad } from "@/database/entities/activity-metrics";
import { stravaActivities } from "@/database/entities/strava-activities";
import { filterSeriesFromDate } from "@/services/metrics/date-helpers";
import { buildDailyLoadSeries } from "@/services/metrics/training-load";

const activityLocalDate = sql<string>`coalesce(date(${stravaActivities.startDateLocal}), date(${stravaActivities.startDate}))`;

async function loadDailyAggregates(userId: string) {
  return db
    .select({
      date: activityLocalDate,
      trainingLoad: sql<number>`coalesce(sum(${activityMetrics.trainingLoad}), 0)`,
      activityCount: sql<number>`count(*)::int`,
    })
    .from(activityMetrics)
    .innerJoin(stravaActivities, eq(stravaActivities.id, activityMetrics.activityId))
    .where(
      and(eq(stravaActivities.userId, userId), sql`${activityMetrics.trainingLoad} is not null`),
    )
    .groupBy(activityLocalDate)
    .orderBy(activityLocalDate);
}

/**
 * Rebuilds CTL/ATL/TSB daily series from all activity metrics for a user.
 *
 * Always aggregates full history so CTL/ATL seed correctly; `fromDate` only limits
 * which rows are written back to `daily_training_load`.
 */
export async function rebuildDailyTrainingLoad(userId: string, fromDate?: string): Promise<number> {
  const rows = await loadDailyAggregates(userId);

  if (rows.length === 0) {
    await db.delete(dailyTrainingLoad).where(eq(dailyTrainingLoad.userId, userId));
    return 0;
  }

  const series = buildDailyLoadSeries(
    rows.map((row) => ({
      date: row.date,
      trainingLoad: Number(row.trainingLoad),
      activityCount: Number(row.activityCount),
    })),
  );

  const upsertRows = filterSeriesFromDate(series, fromDate);

  if (upsertRows.length === 0) {
    return 0;
  }

  if (fromDate) {
    await db
      .delete(dailyTrainingLoad)
      .where(and(eq(dailyTrainingLoad.userId, userId), gte(dailyTrainingLoad.date, fromDate)));
  } else {
    await db.delete(dailyTrainingLoad).where(eq(dailyTrainingLoad.userId, userId));
  }

  await db.insert(dailyTrainingLoad).values(
    upsertRows.map((row) => ({
      userId,
      date: row.date,
      trainingLoad: row.trainingLoad,
      ctl: row.ctl,
      atl: row.atl,
      tsb: row.tsb,
      isRamping: row.isRamping,
      activityCount: row.activityCount,
    })),
  );

  return upsertRows.length;
}

export async function getDailyTrainingLoadSeries(userId: string, from?: string, to?: string) {
  const filters = [eq(dailyTrainingLoad.userId, userId)];

  if (from) {
    filters.push(gte(dailyTrainingLoad.date, from));
  }
  if (to) {
    filters.push(lte(dailyTrainingLoad.date, to));
  }

  return db
    .select()
    .from(dailyTrainingLoad)
    .where(and(...filters))
    .orderBy(dailyTrainingLoad.date);
}
