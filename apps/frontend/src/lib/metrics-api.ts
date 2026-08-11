import type { InferResponseType } from "hono/client";

import { apiClient } from "@/lib/api-client";

export type DailyMetricsResponse = InferResponseType<typeof apiClient.metrics.daily.$get>;
export type RecomputeMetricsResponse = InferResponseType<typeof apiClient.metrics.recompute.$post>;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultDailyMetricsRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);

  return {
    from: formatDate(from),
    to: formatDate(to),
  };
}

export async function fetchDailyMetrics(range = defaultDailyMetricsRange(), signal?: AbortSignal) {
  const res = await apiClient.metrics.daily.$get({ query: range }, { init: { signal } });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function recomputeMetrics(
  options: { scope?: "all" | "stale"; from?: string; to?: string } = {},
) {
  const res = await apiClient.metrics.recompute.$post({
    query: {
      scope: options.scope ?? "all",
      from: options.from,
      to: options.to,
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}
