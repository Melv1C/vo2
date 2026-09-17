import type { PlannedWorkout, PlannedWorkoutSport } from "@repo/ai";
import { Button } from "@repo/ui/components/ui/button";
import { CheckCircle2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import type { CalendarActivity } from "@/lib/activities-api";

import { sportLabels } from "./training-calendar-constants";
import { dateFromString } from "./training-calendar-store";

type TrainingCalendarDayProps = {
  selectedDate: string;
  selectedWorkouts: PlannedWorkout[];
  selectedActivities: CalendarActivity[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (workout: PlannedWorkout) => void;
  onDelete: (id: string) => void;
};

function formatLongDate(date: string): string {
  return dateFromString(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function TrainingCalendarDay({
  selectedDate,
  selectedWorkouts,
  selectedActivities,
  isLoading,
  onCreate,
  onEdit,
  onDelete,
}: TrainingCalendarDayProps) {
  return (
    <aside className="border-border/70 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-[0.12em] uppercase">
            Selected day
          </p>
          <h3 className="mt-1 text-sm font-semibold">{formatLongDate(selectedDate)}</h3>
        </div>
        <Button variant="outline" size="icon-sm" aria-label="Add workout" onClick={onCreate}>
          <PlusIcon />
        </Button>
      </div>

      {isLoading ? <p className="text-muted-foreground text-xs">Loading the day…</p> : null}

      <div className="space-y-2">
        {selectedWorkouts.map((workout) => (
          <div key={workout.id} className="bg-primary/5 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  {workout.title || sportLabels[workout.sport]}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[0.68rem]">
                  {sportLabels[workout.sport]} · {workout.durationMinutes} min
                </p>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Edit workout"
                  onClick={() => onEdit(workout)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete workout"
                  onClick={() => onDelete(workout.id)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
            {workout.notes ? (
              <p className="text-muted-foreground mt-2 text-xs">{workout.notes}</p>
            ) : null}
          </div>
        ))}

        {selectedActivities.map((activity) => (
          <div key={activity.id} className="rounded-lg border border-emerald-500/30 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-3.5 text-emerald-600" />
              <p className="truncate text-xs font-semibold">
                {activity.name || "Completed activity"}
              </p>
            </div>
            <p className="text-muted-foreground mt-1 pl-5 text-[0.68rem]">
              {activity.sportFamily
                ? (sportLabels[activity.sportFamily as PlannedWorkoutSport] ?? activity.sportFamily)
                : "Activity"}{" "}
              · {activity.durationMinutes} min
            </p>
          </div>
        ))}
      </div>

      {selectedWorkouts.length === 0 && selectedActivities.length === 0 ? (
        <div className="bg-muted/30 mt-2 rounded-lg border border-dashed p-4">
          <p className="text-muted-foreground text-xs">Nothing here yet.</p>
          <Button variant="link" className="mt-1 h-auto p-0 text-xs" onClick={onCreate}>
            Plan this day
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
