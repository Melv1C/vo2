import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardHeader } from "@repo/ui/components/ui/card";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DailyMetricsCharts } from "@/components/daily-metrics-charts";
import { activitiesQueryOptions } from "@/lib/activities-query";
import { authClient, signIn, signOut, useSession } from "@/lib/auth-client";
import {
  dailyMetricsRangeFromPreset,
  defaultDailyMetricsRange,
  recomputeMetrics,
  type MetricsRangePreset,
} from "@/lib/metrics-api";
import { dailyMetricsQueryKey, dailyMetricsQueryOptions } from "@/lib/metrics-query";

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      return null;
    }

    void queryClient.ensureQueryData(activitiesQueryOptions);
    void queryClient.ensureQueryData(dailyMetricsQueryOptions(defaultDailyMetricsRange()));
  },
  component: Home,
});

function Home() {
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  const [rangePreset, setRangePreset] = useState<MetricsRangePreset>("90d");
  const metricsRange = dailyMetricsRangeFromPreset(rangePreset);
  const { data: activities, isFetching } = useQuery({
    ...activitiesQueryOptions,
    enabled: !!session,
    refetchInterval: (query) => {
      const pending = query.state.data?.streamsPendingCount ?? 0;
      return pending > 0 ? 5_000 : false;
    },
  });
  const { data: dailyMetrics, isLoading: dailyMetricsLoading } = useQuery({
    ...dailyMetricsQueryOptions(metricsRange),
    enabled: !!session,
  });
  const recompute = useMutation({
    mutationFn: () => recomputeMetrics(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dailyMetricsQueryKey });
    },
  });

  const hasStreamProgress =
    (activities?.streamsReadyCount ?? 0) > 0 || (activities?.streamsPendingCount ?? 0) > 0;

  return (
    <TooltipProvider>
      <div className="flex w-full max-w-4xl flex-col items-center gap-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="flex flex-col items-center gap-4">
            {session ? (
              <>
                <Avatar>
                  <AvatarImage src={session.user.image ?? undefined} />
                  <AvatarFallback>{session.user.name?.[0]}</AvatarFallback>
                </Avatar>
                <p className="text-center text-sm leading-none font-medium">
                  Signed in as <br />
                  {session.user.name}
                </p>
                <div className="text-muted-foreground flex w-full flex-col gap-3 text-center text-sm">
                  <div>
                    <p>{activities?.activitiesCount ?? 0} activities</p>
                    {activities?.lastFetchedAt && (
                      <p className="text-xs">
                        Last synced {new Date(activities.lastFetchedAt).toLocaleString()}
                        {isFetching ? " · syncing…" : ""}
                      </p>
                    )}
                    {!activities?.lastFetchedAt && isFetching && (
                      <p className="text-xs">Syncing activities…</p>
                    )}
                  </div>

                  {hasStreamProgress && (
                    <p className="text-xs">
                      Streams (HR activities): {activities?.streamsReadyCount ?? 0} ready ·{" "}
                      {activities?.streamsPendingCount ?? 0} pending
                      {(activities?.streamsPendingCount ?? 0) > 0 ? " · backfilling…" : ""}
                    </p>
                  )}

                  {recompute.isSuccess && (
                    <p className="text-xs">
                      Recomputed {recompute.data.processed} activities
                      {recompute.data.skipped > 0 ? ` (${recompute.data.skipped} skipped)` : ""}
                    </p>
                  )}

                  {recompute.isError && (
                    <p className="text-destructive text-xs">Metrics recompute failed</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => recompute.mutate()}
                  disabled={recompute.isPending || isPending}
                >
                  {recompute.isPending ? "Recomputing metrics…" : "Recompute metrics"}
                </Button>
                <Button variant="outline" onClick={() => signOut()} disabled={isPending}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <p className="text-center text-sm leading-none font-medium">Not signed in</p>
                <Button
                  variant="outline"
                  onClick={() =>
                    signIn.oauth2({
                      providerId: "strava",
                      callbackURL: window.location.origin,
                    })
                  }
                  disabled={isPending}
                >
                  Sign in with Strava
                </Button>
              </>
            )}
          </CardHeader>
        </Card>

        {session && (
          <DailyMetricsCharts
            series={dailyMetrics?.series}
            isLoading={dailyMetricsLoading}
            rangePreset={rangePreset}
            onRangePresetChange={setRangePreset}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
