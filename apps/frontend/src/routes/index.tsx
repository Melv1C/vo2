import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardHeader } from "@repo/ui/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";

import { signIn, signOut, useSession } from "@/lib/auth-client";
import { useActivities } from "@/lib/use-activities";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { data: session, isPending } = useSession();
  const { data: activities, isSyncing } = useActivities(!!session);

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
            <div className="text-muted-foreground text-center text-sm">
              <p>{activities?.activitiesCount ?? 0} activities</p>
              {activities?.lastFetchedAt && (
                <p className="text-xs">
                  Last synced {new Date(activities.lastFetchedAt).toLocaleString()}
                  {isSyncing ? " · syncing…" : ""}
                </p>
              )}
              {!activities?.lastFetchedAt && isSyncing && (
                <p className="text-xs">Syncing activities…</p>
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
