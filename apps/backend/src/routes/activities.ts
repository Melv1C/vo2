import { Hono } from "hono";

import {
  getSyncState,
  kickBackgroundSync,
  kickStreamDrain,
  runSyncForUser,
} from "@/integrations/strava/sync-orchestrator";
import { isAuthenticated } from "@/middlewares/use-auth";
import { activityMetricsResponse$ } from "@/schemas/metrics";
import { getActivityMetricsForUser } from "@/services/metrics/compute-activity-metrics";

const emptySummary = {
  activitiesCount: 0,
  lastFetchedAt: null,
  newActivities: 0,
  streamsReadyCount: 0,
  streamsPendingCount: 0,
  lastStreamSyncedAt: null,
};

export const activitiesRoutes = new Hono()
  .use(isAuthenticated)
  .get("/", async (c) => {
    const userId = c.get("user")!.id;
    const state = (await getSyncState(userId)) ?? emptySummary;

    kickBackgroundSync(userId);

    return c.json({
      activitiesCount: state.activitiesCount,
      lastFetchedAt: state.lastFetchedAt,
      newActivities: state.newActivities,
      streamsReadyCount: state.streamsReadyCount,
      streamsPendingCount: state.streamsPendingCount,
      lastStreamSyncedAt: state.lastStreamSyncedAt,
    });
  })
  .post("/sync", async (c) => {
    const result = await runSyncForUser(c.get("user")!.id, { force: true });

    if (!result) {
      return c.json({ message: "No Strava account linked" }, 404);
    }

    return c.json({
      activitiesCount: result.activitiesCount,
      lastFetchedAt: result.lastFetchedAt,
      newActivities: result.newActivities,
    });
  })
  .get("/streams", async (c) => {
    const state = await getSyncState(c.get("user")!.id);

    if (!state) {
      return c.json({ message: "No sync state yet" }, 404);
    }

    return c.json({
      streamsReadyCount: state.streamsReadyCount,
      streamsPendingCount: state.streamsPendingCount,
      lastStreamSyncedAt: state.lastStreamSyncedAt,
      fetchedThisRun: state.streamsFetchedThisRun,
      rateLimited: state.rateLimited,
    });
  })
  .post("/sync/streams", async (c) => {
    const userId = c.get("user")!.id;
    const result = await runSyncForUser(userId, { streamsOnly: true, force: true });

    if (!result) {
      return c.json({ message: "No Strava account linked" }, 404);
    }

    if (result.streamsPendingCount > 0 && !result.rateLimited) {
      kickStreamDrain(userId);
    }

    return c.json({
      streamsReadyCount: result.streamsReadyCount,
      streamsPendingCount: result.streamsPendingCount,
      lastStreamSyncedAt: result.lastStreamSyncedAt,
      fetchedThisRun: result.streamsFetchedThisRun,
      rateLimited: result.rateLimited,
    });
  })
  .get("/:id/metrics", async (c) => {
    const userId = c.get("user")!.id;
    const activityId = c.req.param("id");
    const row = await getActivityMetricsForUser(activityId, userId);

    if (!row) {
      return c.json({ message: "Metrics not found" }, 404);
    }

    return c.json(activityMetricsResponse$.parse(row.metrics));
  });
