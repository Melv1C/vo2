import { Logger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ENV } from "varlock/env";

import { logger } from "@/lib/logger";

class MyLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    logger.info("Drizzle Query", { query, params });
  }
}

export const db = drizzle(ENV.DATABASE_URL, { logger: new MyLogger() });

export const dbWithoutLogging = drizzle(ENV.DATABASE_URL);
