import { Hono } from "hono";
import { cors } from "hono/cors";
import "varlock/auto-load";
import { ENV } from "varlock/env";

import { routes } from "./routes";

const app = new Hono()
  .use(
    cors({
      origin: [ENV.FRONTEND_URL],
      credentials: true,
    }),
  )
  .route("/api", routes);

export type AppType = typeof app;

export default {
  port: ENV.BACKEND_PORT,
  fetch: app.fetch,
};
