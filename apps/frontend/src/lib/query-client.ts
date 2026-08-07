import { QueryClient } from "@tanstack/react-query";

const ACTIVITIES_STALE_TIME_MS = 30_000;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: ACTIVITIES_STALE_TIME_MS,
        refetchOnWindowFocus: true,
      },
    },
  });
}
