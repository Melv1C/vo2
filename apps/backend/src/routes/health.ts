import { sql } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/database";
import { logger } from "@/lib/logger";

export const healthRoutes = new Hono().get("/", async (c) => {
  logger.info("Health check requested");
  let isDatabaseConnected = false;

  try {
    const result = await db.execute(sql`SELECT 1`); // Simple query to check database connectivity;
    isDatabaseConnected = !!result;
  } catch (error) {
    logger.error("Error checking database connectivity", { error });
    isDatabaseConnected = false;
  }

  logger.info("Database connectivity check completed", {
    isDatabaseConnected: !!isDatabaseConnected,
  });
  return c.json(
    {
      status: isDatabaseConnected ? "ok" : "error",
      database: isDatabaseConnected ? "connected" : "disconnected",
    },
    isDatabaseConnected ? 200 : 503,
  );
});
