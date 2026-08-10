import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/database";
import { activityMetrics, dailyTrainingLoad } from "@/database/entities/activity-metrics";
import { stravaActivities } from "@/database/entities/strava-activities";
import { buildDailyLoadSeries } from "@/services/metrics/training-load";

export async function rebuildDailyTrainingLoad(userId: string): Promise<number> {
  const rows = await db
    .select({
      date: sql<string>`coalesce(date(${stravaActivities.startDateLocal}), date(${stravaActivities.startDate}))`,
      trainingLoad: sql<number>`coalesce(sum(${activityMetrics.trainingLoad}), 0)`,
      activityCount: sql<number>`count(*)::int`,
    })
    .from(activityMetrics)
    .innerJoin(stravaActivities, eq(stravaActivities.id, activityMetrics.activityId))
    .where(
      and(eq(stravaActivities.userId, userId), sql`${activityMetrics.trainingLoad} is not null`),
    )
    .groupBy(sql`coalesce(date(${stravaActivities.startDateLocal}), date(${stravaActivities.startDate}))`)
    .orderBy(sql`coalesce(date(${stravaActivities.startDateLocal}), date(${stravaActivities.startDate}))`);

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

  await db.delete(dailyTrainingLoad).where(eq(dailyTrainingLoad.userId, userId));

  if (series.length === 0) {
    return 0;
  }

  await db.insert(dailyTrainingLoad).values(
    series.map((row) => ({
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

  return series.length;
}

export async function getDailyTrainingLoadSeries(
  userId: string,
  from?: string,
  to?: string,
) {
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
