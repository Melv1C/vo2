import { sValidator } from "@hono/standard-validator";
import { listPlannedWorkoutsInputSchema$ } from "@repo/ai";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import * as z from "zod";

import { db } from "@/database";
import { activityMetrics } from "@/database/entities/activity-metrics";
import { stravaActivities } from "@/database/entities/strava-activities";
import { isAuthenticated } from "@/middlewares/use-auth";
import { isPlannedWorkoutRangeWithinLimit } from "@/services/planned-workouts-range";

const calendarQuery$ = listPlannedWorkoutsInputSchema$
  .extend({ to: z.iso.date() })
  .refine(({ from, to }) => isPlannedWorkoutRangeWithinLimit(from, to));

/** Groups completed activities by the athlete's local calendar day, with UTC as a fallback. */
const activityLocalDate = sql<string>`coalesce(date(${stravaActivities.startDateLocal}), date(${stravaActivities.startDate}))`;

export const calendarRoutes = new Hono()
  .use(isAuthenticated)
  .get("/", sValidator("query", calendarQuery$), async (c) => {
    const { from, to } = c.req.valid("query");

    const rows = await db
      .select({
        id: stravaActivities.id,
        date: activityLocalDate,
        name: stravaActivities.name,
        sportFamily: activityMetrics.sportFamily,
        sportType: stravaActivities.sportType,
        durationMinutes:
          sql<number>`round(coalesce(${stravaActivities.movingTime}, ${stravaActivities.elapsedTime}, 0) / 60.0, 1)`.mapWith(
            Number,
          ),
      })
      .from(stravaActivities)
      .leftJoin(activityMetrics, eq(activityMetrics.activityId, stravaActivities.id))
      .where(
        and(
          eq(stravaActivities.userId, c.get("user")!.id),
          gte(activityLocalDate, from),
          lte(activityLocalDate, to),
        ),
      )
      .orderBy(activityLocalDate);

    return c.json({ activities: rows });
  });
