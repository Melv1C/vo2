export type AssistantCalendarContext = {
  date: string;
  weekday: string;
  timeZone: string;
};

export function resolveAssistantTimeZone(value: string | undefined): string {
  if (!value) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export function getAssistantCalendarContext(
  timeZone: string,
  now = new Date(),
): AssistantCalendarContext {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    weekday: values.weekday!,
    timeZone,
  };
}
