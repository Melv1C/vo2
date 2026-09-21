import type { PlannedWorkout, PlannedWorkoutSport } from "@repo/ai";
import { create } from "zustand";

export type WorkoutDraft = {
  date: string;
  sport: PlannedWorkoutSport;
  durationMinutes: string;
  title: string;
  notes: string;
};

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromString(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function monthRange(month: Date) {
  return {
    from: formatDateLocal(new Date(month.getFullYear(), month.getMonth(), 1)),
    to: formatDateLocal(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

export function initialDraft(date: string, workout?: PlannedWorkout): WorkoutDraft {
  return {
    date: workout?.date ?? date,
    sport: workout?.sport ?? "running",
    durationMinutes: workout ? String(workout.durationMinutes) : "45",
    title: workout?.title ?? "",
    notes: workout?.notes ?? "",
  };
}

type TrainingCalendarState = {
  month: Date;
  selectedDate: string;
  dialogOpen: boolean;
  editingWorkout: PlannedWorkout | undefined;
  draft: WorkoutDraft;
  changeMonth: (month: Date) => void;
  selectDate: (date: string) => void;
  openCreate: (date?: string) => void;
  openEdit: (workout: PlannedWorkout) => void;
  closeDialog: () => void;
  setDraft: (changes: Partial<WorkoutDraft>) => void;
};

const today = formatDateLocal(new Date());

export const useTrainingCalendarStore = create<TrainingCalendarState>((set) => ({
  month: new Date(),
  selectedDate: today,
  dialogOpen: false,
  editingWorkout: undefined,
  draft: initialDraft(today),
  changeMonth: (month) =>
    set({
      month,
      selectedDate: formatDateLocal(new Date(month.getFullYear(), month.getMonth(), 1)),
    }),
  selectDate: (selectedDate) => {
    const date = dateFromString(selectedDate);
    set({
      selectedDate,
      month: new Date(date.getFullYear(), date.getMonth(), 1),
    });
  },
  openCreate: (date = today) =>
    set({ editingWorkout: undefined, draft: initialDraft(date), dialogOpen: true }),
  openEdit: (editingWorkout) =>
    set({
      editingWorkout,
      draft: initialDraft(editingWorkout.date, editingWorkout),
      dialogOpen: true,
    }),
  closeDialog: () => set({ dialogOpen: false }),
  setDraft: (changes) => set((state) => ({ draft: { ...state.draft, ...changes } })),
}));
