import type {
  CreatePlannedWorkoutInput,
  PlannedWorkoutSport,
  UpdatePlannedWorkoutInput,
} from "@repo/ai";
import { Button } from "@repo/ui/components/ui/button";
import { Calendar } from "@repo/ui/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { calendarActivitiesQueryOptions } from "@/lib/calendar-query";
import {
  createPlannedWorkout,
  deletePlannedWorkout,
  type PlannedWorkout,
  updatePlannedWorkout,
} from "@/lib/planned-workouts-api";
import { plannedWorkoutsQueryKey, plannedWorkoutsQueryOptions } from "@/lib/planned-workouts-query";

const sportOptions: Array<{ value: PlannedWorkoutSport; label: string }> = [
  { value: "cycling", label: "Cycling" },
  { value: "running", label: "Running" },
  { value: "swimming", label: "Swimming" },
  { value: "walking", label: "Walking" },
  { value: "strength", label: "Strength" },
  { value: "mobility", label: "Mobility" },
  { value: "other", label: "Other" },
];

const sportLabels = Object.fromEntries(
  sportOptions.map((sport) => [sport.value, sport.label]),
) as Record<PlannedWorkoutSport, string>;

const emptyWorkouts: PlannedWorkout[] = [];
const emptyActivities: Array<{
  id: string;
  date: string;
  name: string | null;
  sportFamily: string | null;
  sportType: string | null;
  durationMinutes: number;
}> = [];

type WorkoutDraft = {
  date: string;
  sport: PlannedWorkoutSport;
  durationMinutes: string;
  title: string;
  notes: string;
};

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromString(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function monthRange(month: Date) {
  return {
    from: formatDateLocal(new Date(month.getFullYear(), month.getMonth(), 1)),
    to: formatDateLocal(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

function initialDraft(date: string, workout?: PlannedWorkout): WorkoutDraft {
  return {
    date: workout?.date ?? date,
    sport: workout?.sport ?? "running",
    durationMinutes: workout ? String(workout.durationMinutes) : "45",
    title: workout?.title ?? "",
    notes: workout?.notes ?? "",
  };
}

function formatLongDate(date: string): string {
  return dateFromString(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function TrainingCalendar() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => formatDateLocal(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<PlannedWorkout>();
  const [draft, setDraft] = useState(() => initialDraft(formatDateLocal(new Date())));
  const range = monthRange(month);
  const plannedQuery = useQuery(plannedWorkoutsQueryOptions(range.from, range.to));
  const activityQuery = useQuery(calendarActivitiesQueryOptions(range.from, range.to));

  const plannedWorkouts = plannedQuery.data?.workouts ?? emptyWorkouts;
  const activities = activityQuery.data?.activities ?? emptyActivities;
  const selectedWorkouts = plannedWorkouts.filter((workout) => workout.date === selectedDate);
  const selectedActivities = activities.filter((activity) => activity.date === selectedDate);
  const plannedDates = useMemo(
    () => plannedWorkouts.map((workout) => dateFromString(workout.date)),
    [plannedWorkouts],
  );
  const activityDates = useMemo(
    () => activities.map((activity) => dateFromString(activity.date)),
    [activities],
  );

  const createMutation = useMutation({
    mutationFn: (input: CreatePlannedWorkoutInput) => createPlannedWorkout(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: plannedWorkoutsQueryKey });
      setDialogOpen(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: UpdatePlannedWorkoutInput) => updatePlannedWorkout(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: plannedWorkoutsQueryKey });
      setDialogOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlannedWorkout(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: plannedWorkoutsQueryKey });
      setDialogOpen(false);
    },
  });

  function openCreate(date = selectedDate) {
    setEditingWorkout(undefined);
    setDraft(initialDraft(date));
    setDialogOpen(true);
  }

  function openEdit(workout: PlannedWorkout) {
    setEditingWorkout(workout);
    setDraft(initialDraft(workout.date, workout));
    setDialogOpen(true);
  }

  function handleMonthChange(nextMonth: Date) {
    setMonth(nextMonth);
    setSelectedDate(formatDateLocal(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)));
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const durationMinutes = Number(draft.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1_440)
      return;

    const title = draft.title.trim();
    const notes = draft.notes.trim();
    const common = {
      date: draft.date,
      sport: draft.sport,
      durationMinutes,
      title: title || undefined,
      notes: notes || undefined,
    };
    if (editingWorkout) {
      updateMutation.mutate({
        id: editingWorkout.id,
        ...common,
        title: title || null,
        notes: notes || null,
      });
    } else {
      createMutation.mutate(common);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  return (
    <Card className="w-full overflow-visible">
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
              <CalendarDaysIcon className="size-3.5" />
              Training plan
            </div>
            <CardTitle className="text-xl tracking-tight">Make the week visible.</CardTitle>
            <CardDescription className="mt-1">
              Planned sessions and completed Strava activities share the same calendar.
            </CardDescription>
          </div>
          <Button onClick={() => openCreate()} size="sm">
            <PlusIcon />
            Add workout
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() =>
                  handleMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                }
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                onClick={() =>
                  handleMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                }
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>

          <Calendar
            mode="single"
            month={month}
            onMonthChange={handleMonthChange}
            selected={dateFromString(selectedDate)}
            onSelect={(date) => {
              if (date) setSelectedDate(formatDateLocal(date));
            }}
            modifiers={{
              hasPlanned: plannedDates,
              hasCompleted: activityDates,
            }}
            modifiersClassNames={{
              hasPlanned: "bg-primary/10 text-primary font-semibold",
              hasCompleted: "ring-1 ring-emerald-500/70 ring-inset",
            }}
            className="mx-auto w-full max-w-md"
          />
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-2 px-2 text-[0.65rem]">
            <span className="flex items-center gap-1.5">
              <span className="bg-primary size-1.5 rounded-full" /> Planned workout
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-emerald-500" /> Completed activity
            </span>
          </div>
        </div>

        <aside className="border-border/70 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-[0.12em] uppercase">
                Selected day
              </p>
              <h3 className="mt-1 text-sm font-semibold">{formatLongDate(selectedDate)}</h3>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Add workout"
              onClick={() => openCreate()}
            >
              <PlusIcon />
            </Button>
          </div>

          {plannedQuery.isLoading || activityQuery.isLoading ? (
            <p className="text-muted-foreground text-xs">Loading the day…</p>
          ) : null}

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
                      onClick={() => openEdit(workout)}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete workout"
                      onClick={() => {
                        if (window.confirm("Delete this planned workout?"))
                          deleteMutation.mutate(workout.id);
                      }}
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
                    ? (sportLabels[activity.sportFamily as PlannedWorkoutSport] ??
                      activity.sportFamily)
                    : "Activity"}{" "}
                  · {activity.durationMinutes} min
                </p>
              </div>
            ))}
          </div>

          {selectedWorkouts.length === 0 && selectedActivities.length === 0 ? (
            <div className="bg-muted/30 mt-2 rounded-lg border border-dashed p-4">
              <p className="text-muted-foreground text-xs">Nothing here yet.</p>
              <Button
                variant="link"
                className="mt-1 h-auto p-0 text-xs"
                onClick={() => openCreate()}
              >
                Plan this day
              </Button>
            </div>
          ) : null}
        </aside>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWorkout ? "Edit planned workout" : "Plan a workout"}</DialogTitle>
            <DialogDescription>
              Keep it simple for now. You can add detailed targets later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitDraft} className="space-y-3">
            <label className="grid gap-1.5 text-xs font-medium">
              Date
              <Input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-xs font-medium">
                Sport
                <NativeSelect
                  value={draft.sport}
                  onChange={(event) =>
                    setDraft({ ...draft, sport: event.target.value as PlannedWorkoutSport })
                  }
                >
                  {sportOptions.map((sport) => (
                    <NativeSelectOption key={sport.value} value={sport.value}>
                      {sport.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <label className="grid gap-1.5 text-xs font-medium">
                Duration (min)
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value })}
                  required
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs font-medium">
              Title <span className="text-muted-foreground font-normal">Optional</span>
              <Input
                value={draft.title}
                maxLength={200}
                placeholder="Easy aerobic run"
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium">
              Notes <span className="text-muted-foreground font-normal">Optional</span>
              <Textarea
                value={draft.notes}
                maxLength={2_000}
                placeholder="A short note for this session"
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
            {mutationError ? (
              <p className="text-destructive text-xs">{mutationError.message}</p>
            ) : null}
            <DialogFooter>
              {editingWorkout ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm("Delete this planned workout?"))
                      deleteMutation.mutate(editingWorkout.id);
                  }}
                  disabled={isSaving || deleteMutation.isPending}
                >
                  Delete
                </Button>
              ) : null}
              <Button type="submit" disabled={isSaving || deleteMutation.isPending}>
                {isSaving ? "Saving…" : editingWorkout ? "Save changes" : "Plan workout"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
