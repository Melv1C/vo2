import { Hono } from "hono";

export const healthRoutes = new Hono().get("/", async (c) => {
  return c.json({ status: "ok" });
});
