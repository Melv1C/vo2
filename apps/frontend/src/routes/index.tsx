import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardHeader } from "@repo/ui/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";

import { signIn, signOut, useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { data: session, isPending } = useSession();

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
