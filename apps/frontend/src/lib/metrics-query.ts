import { queryOptions } from "@tanstack/react-query";

import { defaultDailyMetricsRange, fetchDailyMetrics } from "@/lib/metrics-api";

const range = defaultDailyMetricsRange();

export const dailyMetricsQueryKey = ["metrics", "daily", range] as const;

export const dailyMetricsQueryOptions = queryOptions({
  queryKey: dailyMetricsQueryKey,
  queryFn: ({ signal }) => fetchDailyMetrics(range, signal),
});
