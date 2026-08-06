import { Hono } from "hono";

import { healthRoutes } from "./health";

export const routes = new Hono().route("/health", healthRoutes).onError((err, c) => {
  console.error("Unhandled error occurred", err);
  return c.json({ message: "Internal Server Error" }, 500);
});
