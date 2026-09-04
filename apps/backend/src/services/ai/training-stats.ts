import type { TrainingStatsInput, TrainingStatsOutput } from "@repo/ai";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/database";
import { activityMetrics, dailyTrainingLoad } from "@/database/entities/activity-metrics";
import { activitySyncState } from "@/database/entities/activity-sync-state";
import { stravaActivities } from "@/database/entities/strava-activities";
import { normalizeTrainingStatsRange } from "@/services/ai/training-stats-range";
import { loadAthleteProfile } from "@/services/metrics/context";

const MAX_ACTIVITY_ROWS = 100;
const activityLocalDate = sql<string>`coalesce(date(${stravaActivities.startDateLocal}), date(${stravaActivities.startDate}))`;

function toNumber(value: number | null | undefined): number | null {
  return value == null ? null : Number(value);
}

export async function getTrainingStats(
  userId: string,
  input: TrainingStatsInput,
): Promise<TrainingStatsOutput> {
  const range = normalizeTrainingStatsRange(input);
  const profile = await loadAthleteProfile(userId);
  const [syncState] = await db
    .select()
    .from(activitySyncState)
    .where(eq(activitySyncState.userId, userId));

  const dailyRows = await db
    .select()
    .from(dailyTrainingLoad)
    .where(
      and(
        eq(dailyTrainingLoad.userId, userId),
        gte(dailyTrainingLoad.date, range.from),
        lte(dailyTrainingLoad.date, range.to),
      ),
    )
    .orderBy(dailyTrainingLoad.date);

  const activityFilters = [eq(stravaActivities.userId, userId)];
  if (input.activityId) {
    activityFilters.push(eq(activityMetrics.activityId, input.activityId));
  } else {
    activityFilters.push(gte(activityLocalDate, range.from), lte(activityLocalDate, range.to));
  }
  if (input.sportFamily) {
    activityFilters.push(eq(activityMetrics.sportFamily, input.sportFamily));
  }

  const activitySummaryRows = await db
    .select({
      sportFamily: activityMetrics.sportFamily,
      activityCount: sql<number>`count(*)::int`,
      trainingLoad: sql<number>`coalesce(sum(${activityMetrics.trainingLoad}), 0)`,
      movingTimeSeconds: sql<number>`coalesce(sum(${activityMetrics.movingTimeS}), 0)`,
    })
    .from(activityMetrics)
    .innerJoin(stravaActivities, eq(stravaActivities.id, activityMetrics.activityId))
    .where(and(...activityFilters))
    .groupBy(activityMetrics.sportFamily)
    .orderBy(desc(sql<number>`coalesce(sum(${activityMetrics.trainingLoad}), 0)`));

  const activityRows = await db
    .select({
      id: stravaActivities.id,
      name: stravaActivities.name,
      sportFamily: activityMetrics.sportFamily,
      sportType: stravaActivities.sportType,
      date: activityLocalDate,
      movingTimeS: activityMetrics.movingTimeS,
      distance: stravaActivities.distance,
      trainingLoad: activityMetrics.trainingLoad,
      averageHeartRate: activityMetrics.avgHr,
      averageWatts: stravaActivities.averageWatts,
      dataQuality: activityMetrics.dataQuality,
      crossChecks: activityMetrics.crossChecks,
    })
    .from(activityMetrics)
    .innerJoin(stravaActivities, eq(stravaActivities.id, activityMetrics.activityId))
    .where(and(...activityFilters))
    .orderBy(desc(activityLocalDate))
    .limit(input.activityId ? 1 : MAX_ACTIVITY_ROWS);

  const totalActivityCount = activitySummaryRows.reduce(
    (total, row) => total + Number(row.activityCount),
    0,
  );
  const totalTrainingLoad = activitySummaryRows.reduce(
    (total, row) => total + Number(row.trainingLoad),
    0,
  );
  const latestDailyRow = dailyRows.at(-1);
  const notes: string[] = [];

  if (input.sportFamily) {
    notes.push(
      "The daily CTL, ATL, and TSB series is the athlete-wide series. The activity and sport summary is filtered to the requested sport family.",
    );
  }
  if (activityRows.length === MAX_ACTIVITY_ROWS && !input.activityId) {
    notes.push(`Only the ${MAX_ACTIVITY_ROWS} most recent matching activities are listed.`);
  }
  if (!latestDailyRow) {
    notes.push("No daily training-load rows were found for this range.");
  }
  if ((syncState?.streamsPendingCount ?? 0) > 0) {
    notes.push("Some activity streams are still pending and computed metrics may be incomplete.");
  }

  return {
    range,
    summary: {
      activityCount: totalActivityCount,
      trainingLoad: Number(totalTrainingLoad.toFixed(2)),
      averageDailyLoad:
        dailyRows.length === 0 ? 0 : Number((totalTrainingLoad / dailyRows.length).toFixed(2)),
      ctl: toNumber(latestDailyRow?.ctl),
      atl: toNumber(latestDailyRow?.atl),
      tsb: toNumber(latestDailyRow?.tsb),
      sports: activitySummaryRows.map((row) => ({
        sportFamily: row.sportFamily,
        activityCount: Number(row.activityCount),
        trainingLoad: Number(Number(row.trainingLoad).toFixed(2)),
        movingTimeMinutes: Number((Number(row.movingTimeSeconds) / 60).toFixed(1)),
      })),
    },
    daily: dailyRows.map((row) => ({
      date: row.date,
      trainingLoad: Number(row.trainingLoad),
      ctl: Number(row.ctl),
      atl: Number(row.atl),
      tsb: Number(row.tsb),
      activityCount: row.activityCount,
    })),
    activities: activityRows.map((row) => ({
      id: row.id,
      name: row.name,
      sportFamily: row.sportFamily,
      sportType: row.sportType,
      date: row.date,
      movingTimeMinutes:
        row.movingTimeS == null ? null : Number((Number(row.movingTimeS) / 60).toFixed(1)),
      distanceKm: row.distance == null ? null : Number((Number(row.distance) / 1000).toFixed(2)),
      trainingLoad: toNumber(row.trainingLoad),
      averageHeartRate: toNumber(row.averageHeartRate),
      averageWatts: toNumber(row.averageWatts),
      dataQuality:
        row.dataQuality == null
          ? null
          : {
              coveragePct: Number(row.dataQuality.coveragePct),
              downgraded: row.crossChecks?.downgraded ?? false,
            },
    })),
    athlete: {
      weightKg: toNumber(profile?.weightKg),
      restingHr: toNumber(profile?.restingHr),
      maxHr: toNumber(profile?.maxHr),
      lthr: toNumber(profile?.lthr),
      ftp: toNumber(profile?.ftp),
      thresholdPaceMps: toNumber(profile?.thresholdPaceMps),
      thresholdSwimPaceMps: toNumber(profile?.thresholdSwimPaceMps),
    },
    dataQuality: {
      streamsPendingCount: syncState?.streamsPendingCount ?? 0,
      streamsReadyCount: syncState?.streamsReadyCount ?? 0,
      activitiesWithMetrics: totalActivityCount,
    },
    notes,
  };
}
