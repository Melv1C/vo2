import type { AppType } from "backend/client";
import { hc } from "hono/client";
import { ENV } from "varlock/env";

/** Typed Hono RPC client — routes mirror backend `/api`. */
export const apiClient = hc<AppType>(`${ENV.BACKEND_URL}/api`, {
  init: { credentials: "include" },
});
