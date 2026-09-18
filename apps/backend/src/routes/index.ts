import { Hono } from "hono";

import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { useAuth } from "@/middlewares/use-auth";
import { useLogger } from "@/middlewares/use-logger";

import { activitiesRoutes } from "./activities";
import { athleteRoutes } from "./athlete";
import { calendarRoutes } from "./calendar";
import { chatRoutes } from "./chat";
import { healthRoutes } from "./health";
import { metricsRoutes } from "./metrics";
import { plannedWorkoutRoutes } from "./planned-workouts";

export const routes = new Hono()
  .use(useAuth)
  .on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw))

  .use(useLogger)
  .route("/health", healthRoutes)
  .route("/activities", activitiesRoutes)
  .route("/calendar", calendarRoutes)
  .route("/athlete", athleteRoutes)
  .route("/chat", chatRoutes)
  .route("/metrics", metricsRoutes)
  .route("/workouts", plannedWorkoutRoutes)
  .onError((error, c) => {
    logger.error("Unhandled error occurred", { error });
    return c.json({ message: "Internal Server Error" }, 500);
  });

export type AppType = typeof routes;
