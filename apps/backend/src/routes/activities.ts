import { Hono } from "hono";

import {
  getActivitiesSummary,
  triggerActivitySyncForUser,
} from "@/integrations/strava/sync-activities";
import { isAuthenticated } from "@/middlewares/use-auth";

const emptySummary = {
  activitiesCount: 0,
  lastFetchedAt: null,
  newActivities: 0,
};

export const activitiesRoutes = new Hono()
  .use(isAuthenticated)
  .get("/", async (c) => {
    const summary = await getActivitiesSummary(c.get("user")!.id);
    return c.json(summary ?? emptySummary);
  })
  .post("/sync", async (c) => {
    const summary = await triggerActivitySyncForUser(c.get("user")!.id);

    if (!summary) {
      return c.json({ message: "No Strava account linked" }, 404);
    }

    return c.json(summary);
  });
