import type { InferResponseType } from "hono/client";

import { apiClient } from "@/lib/api-client";

export type DailyMetricsResponse = InferResponseType<typeof apiClient.metrics.daily.$get>;
export type RecomputeMetricsResponse = InferResponseType<typeof apiClient.metrics.recompute.$post>;

export type DailyMetricsRange = {
  from?: string;
  to?: string;
};

export type MetricsRangePreset = "30d" | "90d" | "180d" | "365d" | "all";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeEndingToday(days: number): DailyMetricsRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  return {
    from: formatDate(from),
    to: formatDate(to),
  };
}

export function defaultDailyMetricsRange(): DailyMetricsRange {
  return rangeEndingToday(90);
}

export function dailyMetricsRangeFromPreset(preset: MetricsRangePreset): DailyMetricsRange {
  switch (preset) {
    case "30d":
      return rangeEndingToday(30);
    case "90d":
      return rangeEndingToday(90);
    case "180d":
      return rangeEndingToday(180);
    case "365d":
      return rangeEndingToday(365);
    case "all":
      return {};
  }
}

export async function fetchDailyMetrics(
  range: DailyMetricsRange = defaultDailyMetricsRange(),
  signal?: AbortSignal,
) {
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
