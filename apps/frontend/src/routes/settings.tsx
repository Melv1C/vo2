import { buttonVariants } from "@repo/ui/components/ui/button";
import { Card, CardHeader } from "@repo/ui/components/ui/card";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AthleteProfileForm } from "@/components/athlete-profile-form";
import { AthleteZonesForm } from "@/components/athlete-zones-form";
import { athleteProfileQueryOptions, athleteZonesQueryOptions } from "@/lib/athlete-query";
import { authClient, useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/settings")({
  loader: async ({ context: { queryClient } }) => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      return null;
    }

    void queryClient.ensureQueryData(athleteProfileQueryOptions);
    void queryClient.ensureQueryData(athleteZonesQueryOptions);
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Loading…
      </p>
    );
  }

  if (!session) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-3">
          <p className="text-center text-sm font-medium">Sign in to edit athlete settings</p>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Back to dashboard
          </Link>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-medium">Settings</h1>
        <p className="text-muted-foreground text-xs">
          Athlete profile and training zones that drive metrics computation.
        </p>
      </div>
      <AthleteProfileForm />
      <AthleteZonesForm />
    </div>
  );
}
