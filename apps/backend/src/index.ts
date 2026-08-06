import "varlock/auto-load";
import { Hono } from "hono";
import { ENV } from "varlock/env";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

export default {
  port: ENV.BACKEND_PORT,
  fetch: app.fetch,
};
