import { and, eq, gte, lte, lt, or, sql } from "drizzle-orm";

import { db } from "@/database";
import { activityMetrics } from "@/database/entities/activity-metrics";
import { activityStreams, stravaActivities } from "@/database/entities/strava-activities";
import { loadAthleteContext } from "@/services/metrics/context";
import { computeActivityCrossChecks } from "@/services/metrics/cross-check";
import { resolveTrainingLoad } from "@/services/metrics/load-resolver";
import { getSportModule, getUniversalModule } from "@/services/metrics/registry";
import { rebuildDailyTrainingLoad } from "@/services/metrics/rebuild-daily-training-load";
import { sanitizeStream } from "@/services/metrics/sanitize-stream";
import { resolveSportFamily } from "@/services/metrics/sport-family";
import type {
  AnchorSnapshot,
  AthleteContext,
  RawStreamInput,
  SportPayload,
} from "@/services/metrics/types";
import { METRICS_VERSION } from "@/services/metrics/types";

import "./bootstrap";

export type ComputeActivityResult = {
  activityId: string;
  computed: boolean;
  reason?: string;
};

export type RecomputeSummary = {
  processed: number;
  skipped: number;
  results: ComputeActivityResult[];
};

function buildAnchorSnapshot(athlete: AthleteContext): AnchorSnapshot {
  return {
    maxHr: athlete.maxHr,
    restingHr: athlete.restingHr,
    lthr: athlete.lthr,
    ftp: athlete.ftp,
    thresholdPaceMps: athlete.thresholdPaceMps,
    weightKg: athlete.weightKg,
    sex: athlete.sex,
  };
}

function toRawStreamInput(stream: typeof activityStreams.$inferSelect): RawStreamInput {
  return {
    timeS: stream.timeS,
    distanceM: stream.distanceM,
    altitudeM: stream.altitudeM,
    velocityMps: stream.velocityMps,
    heartrate: stream.heartrate,
    cadence: stream.cadence,
    watts: stream.watts,
    moving: stream.moving,
    gradePct: stream.gradePct,
  };
}

export async function computeAndPersistActivityMetrics(
  activityId: string,
): Promise<ComputeActivityResult> {
  const [row] = await db
    .select({
      activity: stravaActivities,
      stream: activityStreams,
    })
    .from(stravaActivities)
    .innerJoin(activityStreams, eq(activityStreams.activityId, stravaActivities.id))
    .where(and(eq(stravaActivities.id, activityId), eq(stravaActivities.streamsStatus, "ready")));

  if (!row) {
    return { activityId, computed: false, reason: "activity_not_ready" };
  }

  const athlete = await loadAthleteContext(row.activity.userId, row.activity.startDate);
  const sanitized = sanitizeStream(toRawStreamInput(row.stream));
  const sportFamily = resolveSportFamily(row.activity.sportType);
  const universal = getUniversalModule().compute({ stream: sanitized, athlete });

  if (universal.movingTimeS <= 0 || universal.avgHr == null) {
    return { activityId, computed: false, reason: "no_hr_samples" };
  }

  const sportModule = getSportModule(sportFamily);
  const sportContext = {
    stream: sanitized,
    athlete,
    sportFamily,
    deviceWatts: row.activity.deviceWatts === true,
  };

  const sportResult =
    sportModule?.canCompute(sportContext) === true ? sportModule.compute(sportContext) : {};

  const decouplingPct = sportResult.decouplingPct ?? universal.decouplingPct;
  const sportPayload: SportPayload | null = sportResult.sportPayload ?? null;
  const energyKcal = sportResult.energyKcal ?? null;
  const weightKgUsed = athlete.weightKg;

  const computedAt = new Date();
  const anchorSnapshot = buildAnchorSnapshot(athlete);

  const crossChecks = computeActivityCrossChecks({
    trimpBanister: universal.trimpBanister,
    trimpEdwards: universal.trimpEdwards,
    hrTss: universal.hrTss,
    decouplingPct,
    dataQuality: sanitized.quality,
    sportFamily,
    sportPayload,
  });

  const load = resolveTrainingLoad({
    sportFamily,
    deviceWatts: row.activity.deviceWatts === true,
    trimpBanister: universal.trimpBanister,
    hrTss: universal.hrTss,
    sportPayload,
    anchorSnapshot,
    crossChecks,
  });

  await db
    .insert(activityMetrics)
    .values({
      activityId,
      sportFamily,
      trainingLoad: load.trainingLoad,
      loadSource: load.loadSource,
      trimpBanister: universal.trimpBanister,
      trimpEdwards: universal.trimpEdwards,
      hrTss: universal.hrTss,
      avgHr: universal.avgHr,
      maxHr: universal.maxHr,
      movingTimeS: universal.movingTimeS,
      decouplingPct,
      timeInZone: universal.timeInZone,
      energyKcal,
      weightKgUsed,
      sportPayload,
      dataQuality: sanitized.quality,
      crossChecks: load.crossChecks,
      anchorSnapshot,
      metricsVersion: METRICS_VERSION,
      computedAt,
    })
    .onConflictDoUpdate({
      target: activityMetrics.activityId,
      set: {
        sportFamily,
        trainingLoad: load.trainingLoad,
        loadSource: load.loadSource,
        trimpBanister: universal.trimpBanister,
        trimpEdwards: universal.trimpEdwards,
        hrTss: universal.hrTss,
        avgHr: universal.avgHr,
        maxHr: universal.maxHr,
        movingTimeS: universal.movingTimeS,
        decouplingPct,
        timeInZone: universal.timeInZone,
        energyKcal,
        weightKgUsed,
        sportPayload,
        dataQuality: sanitized.quality,
        crossChecks: load.crossChecks,
        anchorSnapshot,
        metricsVersion: METRICS_VERSION,
        computedAt,
      },
    });

  return { activityId, computed: true };
}

export async function recomputeMetricsForUser(
  userId: string,
  options: { from?: Date; to?: Date; scope?: "all" | "stale" } = {},
): Promise<RecomputeSummary> {
  const filters = [
    eq(stravaActivities.userId, userId),
    eq(stravaActivities.streamsStatus, "ready"),
  ];

  if (options.scope === "stale") {
    filters.push(
      or(
        sql`${activityMetrics.activityId} is null`,
        lt(activityMetrics.metricsVersion, METRICS_VERSION),
      )!,
    );
  }

  if (options.from) {
    filters.push(gte(stravaActivities.startDate, options.from));
  }
  if (options.to) {
    filters.push(lte(stravaActivities.startDate, options.to));
  }

  const activities = await db
    .select({ id: stravaActivities.id })
    .from(stravaActivities)
    .leftJoin(activityMetrics, eq(activityMetrics.activityId, stravaActivities.id))
    .where(and(...filters))
    .orderBy(stravaActivities.startDate);

  const results: ComputeActivityResult[] = [];
  let processed = 0;
  let skipped = 0;

  for (const activity of activities) {
    const result = await computeAndPersistActivityMetrics(activity.id);
    results.push(result);
    if (result.computed) {
      processed += 1;
    } else {
      skipped += 1;
    }
  }

  if (processed > 0) {
    const fromDate = options.from?.toISOString().slice(0, 10);
    await rebuildDailyTrainingLoad(userId, fromDate);
  }

  return { processed, skipped, results };
}

export async function getActivityMetricsForUser(activityId: string, userId: string) {
  const [row] = await db
    .select({
      metrics: activityMetrics,
      activity: stravaActivities,
    })
    .from(activityMetrics)
    .innerJoin(stravaActivities, eq(stravaActivities.id, activityMetrics.activityId))
    .where(and(eq(activityMetrics.activityId, activityId), eq(stravaActivities.userId, userId)));

  return row ?? null;
}
