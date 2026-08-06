import { Hono } from "hono";

import { auth } from "@/lib/auth";

import { healthRoutes } from "./health";

export const routes = new Hono()
  .on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw))
  .route("/health", healthRoutes)
  .onError((err, c) => {
    console.error("Unhandled error occurred", err);
    return c.json({ message: "Internal Server Error" }, 500);
  });
