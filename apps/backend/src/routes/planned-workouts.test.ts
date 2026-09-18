import { describe, expect, test } from "bun:test";

import { updatePlannedWorkoutBodySchema$, updatePlannedWorkoutInputSchema$ } from "@repo/ai";

describe("update planned workout schemas", () => {
  test("PATCH body accepts a field update without an id", () => {
    expect(updatePlannedWorkoutBodySchema$.parse({ sport: "running" })).toEqual({
      sport: "running",
    });
  });

  test("PATCH body rejects an empty update", () => {
    expect(updatePlannedWorkoutBodySchema$.safeParse({}).success).toBe(false);
  });

  test("tool input still requires a field besides id", () => {
    expect(updatePlannedWorkoutInputSchema$.safeParse({ id: "workout-1" }).success).toBe(false);
    expect(
      updatePlannedWorkoutInputSchema$.parse({ id: "workout-1", durationMinutes: 45 }),
    ).toEqual({ id: "workout-1", durationMinutes: 45 });
  });
});
