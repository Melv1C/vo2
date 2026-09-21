import type { PlannedWorkoutSport } from "@repo/ai";
import { Button } from "@repo/ui/components/ui/button";
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
import type { FormEvent } from "react";

import { sportOptions } from "./training-calendar-constants";
import { useTrainingCalendarStore } from "./training-calendar-store";

type TrainingCalendarDialogProps = {
  isSaving: boolean;
  isDeleting: boolean;
  error: Error | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onClose: () => void;
};

export function TrainingCalendarDialog({
  isSaving,
  isDeleting,
  error,
  onSubmit,
  onDelete,
  onClose,
}: TrainingCalendarDialogProps) {
  const dialogOpen = useTrainingCalendarStore((state) => state.dialogOpen);
  const editingWorkout = useTrainingCalendarStore((state) => state.editingWorkout);
  const draft = useTrainingCalendarStore((state) => state.draft);
  const setDraft = useTrainingCalendarStore((state) => state.setDraft);

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingWorkout ? "Edit planned workout" : "Plan a workout"}</DialogTitle>
          <DialogDescription>
            Keep it simple for now. You can add detailed targets later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="grid gap-1.5 text-xs font-medium">
            Date
            <Input
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ date: event.target.value })}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-xs font-medium">
              Sport
              <NativeSelect
                value={draft.sport}
                onChange={(event) => setDraft({ sport: event.target.value as PlannedWorkoutSport })}
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
                onChange={(event) => setDraft({ durationMinutes: event.target.value })}
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
              onChange={(event) => setDraft({ title: event.target.value })}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">
            Notes <span className="text-muted-foreground font-normal">Optional</span>
            <Textarea
              value={draft.notes}
              maxLength={2_000}
              placeholder="A short note for this session"
              onChange={(event) => setDraft({ notes: event.target.value })}
            />
          </label>
          {error ? <p className="text-destructive text-xs">{error.message}</p> : null}
          <DialogFooter>
            {editingWorkout ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isSaving || isDeleting}
              >
                Delete
              </Button>
            ) : null}
            <Button type="submit" disabled={isSaving || isDeleting}>
              {isSaving ? "Saving…" : editingWorkout ? "Save changes" : "Plan workout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
