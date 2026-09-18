import { describe, expect, test } from "bun:test";

import { getAssistantCalendarContext, resolveAssistantTimeZone } from "./calendar-context";

describe("assistant calendar context", () => {
  test("resolves the current date in the athlete's timezone", () => {
    const now = new Date("2026-09-18T23:30:00.000Z");

    expect(getAssistantCalendarContext("Europe/Brussels", now)).toEqual({
      date: "2026-09-19",
      weekday: "Saturday",
      timeZone: "Europe/Brussels",
    });
  });

  test("falls back to UTC for a missing or invalid timezone", () => {
    expect(resolveAssistantTimeZone(undefined)).toBe("UTC");
    expect(resolveAssistantTimeZone("not-a-timezone")).toBe("UTC");
  });
});
