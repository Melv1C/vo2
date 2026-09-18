import type {
  CreatePlannedWorkoutInput,
  PlannedWorkout,
  UpdatePlannedWorkoutInput,
} from "@repo/ai";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Calendar } from "@repo/ui/components/ui/calendar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useMemo, type ButtonHTMLAttributes, type FormEvent } from "react";

import type { CalendarActivity } from "@/lib/activities-api";
import { calendarActivitiesQueryOptions } from "@/lib/calendar-query";
import {
  createPlannedWorkout,
  deletePlannedWorkout,
  updatePlannedWorkout,
} from "@/lib/planned-workouts-api";
import { plannedWorkoutsQueryKey, plannedWorkoutsQueryOptions } from "@/lib/planned-workouts-query";

import { emptyActivities, emptyWorkouts } from "./training-calendar-constants";
import { TrainingCalendarDay } from "./training-calendar-day";
import { TrainingCalendarDialog } from "./training-calendar-dialog";
import {
  dateFromString,
  formatDateLocal,
  monthRange,
  useTrainingCalendarStore,
} from "./training-calendar-store";

type CalendarDayButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  day: { date: Date };
  modifiers: Record<string, boolean>;
};

function CalendarDayButton({ day, modifiers, className, ...props }: CalendarDayButtonProps) {
  const isSelected = modifiers.selected;
  const isOutside = modifiers.outside;
  const hasPlanned = modifiers.hasPlanned;
  const hasCompleted = modifiers.hasCompleted;

  return (
    <button
      {...props}
      type="button"
      className={[
        "group/day relative flex h-16 w-full min-w-0 flex-col items-center justify-start gap-1 rounded-none pt-2 text-sm font-medium outline-none transition-colors",
        "hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/50",
        "text-foreground",
        isOutside ? "text-muted-foreground/35" : "",
        className ?? "",
      ].join(" ")}
      aria-label={props["aria-label"]}
    >
      <span
        className={[
          "flex size-8 items-center justify-center rounded-full",
          isSelected ? "bg-foreground text-background" : "",
        ].join(" ")}
      >
        {day.date.getDate()}
      </span>
      <span className="flex h-2 items-center gap-1" aria-hidden="true">
        {hasPlanned ? <span className="bg-primary size-1.5 rounded-sm" /> : null}
        {hasCompleted ? <span className="size-1.5 rounded-full bg-emerald-500" /> : null}
      </span>
    </button>
  );
}

export function TrainingCalendar() {
  const queryClient = useQueryClient();
  const month = useTrainingCalendarStore((state) => state.month);
  const selectedDate = useTrainingCalendarStore((state) => state.selectedDate);
  const editingWorkout = useTrainingCalendarStore((state) => state.editingWorkout);
  const draft = useTrainingCalendarStore((state) => state.draft);
  const changeMonth = useTrainingCalendarStore((state) => state.changeMonth);
  const selectDate = useTrainingCalendarStore((state) => state.selectDate);
  const openCreate = useTrainingCalendarStore((state) => state.openCreate);
  const openEdit = useTrainingCalendarStore((state) => state.openEdit);
  const closeDialog = useTrainingCalendarStore((state) => state.closeDialog);
  const range = monthRange(month);
  const plannedQuery = useQuery(plannedWorkoutsQueryOptions(range.from, range.to));
  const activityQuery = useQuery(calendarActivitiesQueryOptions(range.from, range.to));
  const calendarError = plannedQuery.error ?? activityQuery.error;

  const plannedWorkouts: PlannedWorkout[] = plannedQuery.data?.workouts ?? emptyWorkouts;
  const activities: CalendarActivity[] = activityQuery.data?.activities ?? emptyActivities;
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
      closeDialog();
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: UpdatePlannedWorkoutInput) => updatePlannedWorkout(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: plannedWorkoutsQueryKey });
      closeDialog();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlannedWorkout(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: plannedWorkoutsQueryKey });
      closeDialog();
    },
  });

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const durationMinutes = Number(draft.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1_440)
      return;

    const title = draft.title.trim();
    const notes = draft.notes.trim();
    const common: CreatePlannedWorkoutInput = {
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
    <section className="w-full overflow-visible">
      <header className="border-border/60 flex items-end justify-between gap-4 border-b pb-4">
        <div>
          <div className="text-muted-foreground flex items-center gap-2 text-[0.65rem] font-semibold tracking-[0.16em] uppercase">
            <CalendarDaysIcon className="size-3.5" />
            Training plan
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Planned workouts and completed activities, at a glance.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => openCreate(selectedDate)}
        >
          <PlusIcon />
          Add workout
        </Button>
      </header>

      <div className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        {calendarError ? (
          <Alert variant="destructive" className="lg:col-span-2">
            <AlertTitle>Training calendar unavailable</AlertTitle>
            <AlertDescription>
              We could not load the latest workouts and activities. Try again in a moment.
            </AlertDescription>
          </Alert>
        ) : null}
        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-lg font-semibold tracking-tight">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() => changeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                onClick={() => changeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>

          <Calendar
            mode="single"
            month={month}
            onMonthChange={changeMonth}
            selected={dateFromString(selectedDate)}
            onSelect={(date) => {
              if (date) selectDate(formatDateLocal(date));
            }}
            modifiers={{
              hasPlanned: plannedDates,
              hasCompleted: activityDates,
            }}
            components={{
              DayButton: CalendarDayButton,
            }}
            classNames={{
              root: "w-full",
              months: "w-full",
              month: "w-full gap-3",
              month_caption: "hidden",
              nav: "hidden",
              month_grid: "w-full border-collapse",
              weekdays: "mb-1 flex",
              weekday:
                "flex-1 rounded-none px-0 text-[0.62rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase",
              weeks: "w-full",
              week: "mt-0 h-16 border-b border-border/50 last:border-b-0",
              day: "h-16 rounded-none p-0",
              today: "rounded-none bg-transparent text-foreground",
              outside: "text-muted-foreground/35",
            }}
            className="mx-auto w-full max-w-xl bg-transparent p-0"
          />
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-2 px-1 text-[0.65rem]">
            <span className="flex items-center gap-1.5">
              <span className="bg-primary size-1.5 rounded-sm" /> Planned workout
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Completed activity
            </span>
          </div>
        </div>

        <TrainingCalendarDay
          selectedDate={selectedDate}
          selectedWorkouts={selectedWorkouts}
          selectedActivities={selectedActivities}
          isLoading={plannedQuery.isLoading || activityQuery.isLoading}
          hasError={Boolean(calendarError)}
          onCreate={() => openCreate(selectedDate)}
          onEdit={openEdit}
          onDelete={(id) => {
            if (window.confirm("Delete this planned workout?")) deleteMutation.mutate(id);
          }}
        />
      </div>

      <TrainingCalendarDialog
        isSaving={isSaving}
        isDeleting={deleteMutation.isPending}
        error={mutationError}
        onSubmit={submitDraft}
        onDelete={() => {
          if (editingWorkout && window.confirm("Delete this planned workout?"))
            deleteMutation.mutate(editingWorkout.id);
        }}
      />
    </section>
  );
}
