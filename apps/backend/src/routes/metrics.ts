import { Hono } from "hono";

import { isAuthenticated } from "@/middlewares/use-auth";
import { recomputeMetricsQuery$ } from "@/schemas/metrics";
import { recomputeMetricsForUser } from "@/services/metrics/compute-activity-metrics";

export const metricsRoutes = new Hono().use(isAuthenticated).post("/recompute", async (c) => {
  const userId = c.get("user")!.id;
  const query = recomputeMetricsQuery$.parse({
    scope: c.req.query("scope") ?? "all",
    from: c.req.query("from"),
    to: c.req.query("to"),
  });

  const summary = await recomputeMetricsForUser(userId, {
    from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
    to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
  });

  return c.json({
    processed: summary.processed,
    skipped: summary.skipped,
  });
});
