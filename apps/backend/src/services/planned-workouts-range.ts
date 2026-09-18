const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 30;
export const MAX_PLANNED_WORKOUT_RANGE_DAYS = 366;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return formatDate(next);
}

export function normalizePlannedWorkoutRange(input: { from: string; to?: string }) {
  const from = input.from;
  const to = input.to ?? addDays(from, DEFAULT_RANGE_DAYS);
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || from > to) {
    throw new Error("Planned workout date range is invalid");
  }

  const rangeDays = Math.floor((toTime - fromTime) / DAY_MS) + 1;
  if (rangeDays > MAX_PLANNED_WORKOUT_RANGE_DAYS) {
    throw new Error(
      "Planned workout date range cannot exceed " + MAX_PLANNED_WORKOUT_RANGE_DAYS + " days",
    );
  }

  return { from, to };
}

export function isPlannedWorkoutRangeWithinLimit(from: string, to: string): boolean {
  const fromTime = Date.parse(from + "T00:00:00.000Z");
  const toTime = Date.parse(to + "T00:00:00.000Z");

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || from > to) return false;

  const rangeDays = Math.floor((toTime - fromTime) / DAY_MS) + 1;
  return rangeDays <= MAX_PLANNED_WORKOUT_RANGE_DAYS;
}
