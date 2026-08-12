import { queryOptions } from "@tanstack/react-query";

import {
  defaultDailyMetricsRange,
  fetchDailyMetrics,
  type DailyMetricsRange,
} from "@/lib/metrics-api";

export const dailyMetricsQueryKey = ["metrics", "daily"] as const;

export function dailyMetricsQueryOptions(range: DailyMetricsRange = defaultDailyMetricsRange()) {
  return queryOptions({
    queryKey: [...dailyMetricsQueryKey, range] as const,
    queryFn: ({ signal }) => fetchDailyMetrics(range, signal),
  });
}
