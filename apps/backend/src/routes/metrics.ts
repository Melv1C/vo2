import { Hono } from "hono";

import { isAuthenticated } from "@/middlewares/use-auth";
import {
  dailyMetricsQuery$,
  dailyTrainingLoadPoint$,
  recomputeMetricsQuery$,
  recomputeMetricsResponse$,
} from "@/schemas/metrics";
import { recomputeMetricsForUser } from "@/services/metrics/compute-activity-metrics";
import { getDailyTrainingLoadSeries } from "@/services/metrics/rebuild-daily-training-load";

export const metricsRoutes = new Hono()
  .use(isAuthenticated)
  .get("/daily", async (c) => {
    const userId = c.get("user")!.id;
    const query = dailyMetricsQuery$.parse({
      from: c.req.query("from"),
      to: c.req.query("to"),
    });

    const rows = await getDailyTrainingLoadSeries(userId, query.from, query.to);

    return c.json({
      series: rows.map((row) => dailyTrainingLoadPoint$.parse(row)),
    });
  })
  .post("/recompute", async (c) => {
    const userId = c.get("user")!.id;
    const query = recomputeMetricsQuery$.parse({
      scope: c.req.query("scope") ?? "all",
      from: c.req.query("from"),
      to: c.req.query("to"),
    });

    const summary = await recomputeMetricsForUser(userId, {
      scope: query.scope,
      from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
      to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
    });

    return c.json(recomputeMetricsResponse$.parse(summary));
  });
