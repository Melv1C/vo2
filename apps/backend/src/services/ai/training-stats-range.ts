import type { TrainingStatsInput } from "@repo/ai";

const MAX_RANGE_DAYS = 731;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, amount: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return formatDate(next);
}

export function countCalendarDays(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  return Math.floor((toTime - fromTime) / 86_400_000) + 1;
}

export function normalizeTrainingStatsRange(input: Pick<TrainingStatsInput, "from" | "to">) {
  const to = input.to ?? formatDate(new Date());
  const from = input.from ?? addDays(to, -90);

  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || from > to) {
    throw new Error("Training stats range is invalid");
  }

  const rangeDays = countCalendarDays(from, to);
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new Error(`Training stats range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  return { from, to };
}
