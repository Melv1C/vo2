import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardHeader } from "@repo/ui/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { activitiesQueryOptions } from "@/lib/activities-query";
import { authClient, signIn, signOut, useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      return null;
    }

    void queryClient.ensureQueryData(activitiesQueryOptions);
  },
  component: Home,
});

function Home() {
  const { data: session, isPending } = useSession();
  const { data: activities, isFetching } = useQuery({
    ...activitiesQueryOptions,
    enabled: !!session,
    refetchInterval: (query) => {
      const pending = query.state.data?.streamsPendingCount ?? 0;
      return pending > 0 ? 5_000 : false;
    },
  });

  const hasStreamProgress =
    (activities?.streamsReadyCount ?? 0) > 0 || (activities?.streamsPendingCount ?? 0) > 0;

  return (
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
            <div className="text-muted-foreground w-full space-y-3 text-center text-sm">
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
            </div>
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
  );
}
