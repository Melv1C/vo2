import { Hono } from "hono";

import {
  getActivitiesSummary,
  triggerActivitySyncForUser,
} from "@/integrations/strava/sync-activities";
import {
  getStreamSyncState,
  setStreamsSince,
  triggerStreamSyncForUser,
} from "@/integrations/strava/sync-streams";
import { logger } from "@/lib/logger";
import { isAuthenticated } from "@/middlewares/use-auth";
import { streamsSinceBody$ } from "@/schemas";

const emptySummary = {
  activitiesCount: 0,
  lastFetchedAt: null,
  newActivities: 0,
};

export const activitiesRoutes = new Hono()
  .use(isAuthenticated)
  .get("/", async (c) => {
    const userId = c.get("user")!.id;
    const summary =
      (await triggerActivitySyncForUser(userId)) ?? (await getActivitiesSummary(userId));
    const streamState = await getStreamSyncState(userId);

    if (streamState?.streamsSince && streamState.streamsPendingCount > 0) {
      void triggerStreamSyncForUser(userId).catch((error) => {
        logger.error("[strava-stream-sync] failed", { userId, error });
      });
    }

    return c.json({
      ...(summary ?? emptySummary),
      streamsSince: streamState?.streamsSince ?? null,
      streamsReadyCount: streamState?.streamsReadyCount ?? 0,
      streamsPendingCount: streamState?.streamsPendingCount ?? 0,
      lastStreamSyncedAt: streamState?.lastStreamSyncedAt ?? null,
    });
  })
  .post("/sync", async (c) => {
    const summary = await triggerActivitySyncForUser(c.get("user")!.id);

    if (!summary) {
      return c.json({ message: "No Strava account linked" }, 404);
    }

    return c.json(summary);
  })
  .get("/streams", async (c) => {
    const streamState = await getStreamSyncState(c.get("user")!.id);

    if (!streamState) {
      return c.json({ message: "No sync state yet" }, 404);
    }

    return c.json(streamState);
  })
  .put("/streams-since", async (c) => {
    const parsed = streamsSinceBody$.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ message: "Invalid streamsSince date" }, 400);
    }

    const userId = c.get("user")!.id;
    const result = await setStreamsSince(userId, new Date(parsed.data.streamsSince));

    void triggerStreamSyncForUser(userId).catch((error) => {
      logger.error("[strava-stream-sync] failed", { userId, error });
    });

    return c.json(result);
  })
  .post("/sync/streams", async (c) => {
    const result = await triggerStreamSyncForUser(c.get("user")!.id, { force: true });

    if (!result) {
      return c.json({ message: "No Strava account linked or streams_since not set" }, 404);
    }

    if (result.streamsPendingCount > 0 && !result.rateLimited) {
      const userId = c.get("user")!.id;
      void triggerStreamSyncForUser(userId, { skipCooldown: true }).catch((error) => {
        logger.error("[strava-stream-sync] continuation failed", { userId, error });
      });
    }

    return c.json(result);
  });
