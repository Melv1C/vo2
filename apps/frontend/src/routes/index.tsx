import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardHeader } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { activitiesQueryOptions } from "@/lib/activities-query";
import { authClient, signIn, signOut, useSession } from "@/lib/auth-client";
import { useSetStreamsSince } from "@/lib/streams-since-mutation";

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

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  return iso.slice(0, 10);
}

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
  const setStreamsSince = useSetStreamsSince();
  const [streamsSinceInput, setStreamsSinceInput] = useState("");

  const streamsSinceValue =
    streamsSinceInput || toDateInputValue(activities?.streamsSince ?? undefined);

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

              <div className="space-y-2 text-left">
                <Label htmlFor="streams-since">Detailed data since</Label>
                <Input
                  id="streams-since"
                  type="date"
                  value={streamsSinceValue}
                  onChange={(event) => setStreamsSinceInput(event.target.value)}
                />
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={!streamsSinceValue || setStreamsSince.isPending}
                  onClick={() => {
                    if (!streamsSinceValue) {
                      return;
                    }

                    const iso = new Date(`${streamsSinceValue}T00:00:00`).toISOString();
                    setStreamsSince.mutate(iso);
                  }}
                >
                  {setStreamsSince.isPending ? "Saving…" : "Save stream window"}
                </Button>
                {activities?.streamsSince && (
                  <p className="text-xs">
                    Streams: {activities.streamsReadyCount ?? 0} ready ·{" "}
                    {activities.streamsPendingCount ?? 0} pending
                    {(activities.streamsPendingCount ?? 0) > 0 ? " · backfilling…" : ""}
                  </p>
                )}
              </div>
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
