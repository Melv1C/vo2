import { defineConfig } from "drizzle-kit";
import "varlock/auto-load";
import { ENV } from "varlock/env";

export default defineConfig({
  out: "./migrations",
  schema: "./src/database/entities",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.DATABASE_URL,
  },
});
