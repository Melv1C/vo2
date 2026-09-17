import {
  createPlannedWorkoutInputSchema$,
  listPlannedWorkoutsInputSchema$,
  updatePlannedWorkoutInputSchema$,
} from "@repo/ai";
import { Hono } from "hono";

import { isAuthenticated } from "@/middlewares/use-auth";
import {
  createPlannedWorkout,
  deletePlannedWorkout,
  getPlannedWorkouts,
  updatePlannedWorkout,
} from "@/services/planned-workouts";

const querySchema = listPlannedWorkoutsInputSchema$;

export const plannedWorkoutRoutes = new Hono()
  .use(isAuthenticated)
  .get("/", async (c) => {
    const parsed = querySchema.safeParse({
      from: c.req.query("from"),
      to: c.req.query("to"),
    });
    if (!parsed.success) return c.json({ message: "Invalid planned workout date range" }, 400);

    try {
      return c.json(await getPlannedWorkouts(c.get("user")!.id, parsed.data));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Planned workout date range")) {
        return c.json({ message: error.message }, 400);
      }
      throw error;
    }
  })
  .post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "Invalid planned workout" }, 400);
    }

    const parsed = createPlannedWorkoutInputSchema$.safeParse(body);
    if (!parsed.success) return c.json({ message: "Invalid planned workout" }, 400);

    const workout = await createPlannedWorkout(c.get("user")!.id, parsed.data);
    return c.json({ workout }, 201);
  })
  .patch("/:id", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "Invalid planned workout" }, 400);
    }

    const parsed = updatePlannedWorkoutInputSchema$.safeParse({
      ...(typeof body === "object" && body !== null ? body : {}),
      id: c.req.param("id"),
    });
    if (!parsed.success) return c.json({ message: "Invalid planned workout" }, 400);

    const workout = await updatePlannedWorkout(c.get("user")!.id, parsed.data);
    if (!workout) return c.json({ message: "Planned workout not found" }, 404);
    return c.json({ workout });
  })
  .delete("/:id", async (c) => {
    const deleted = await deletePlannedWorkout(c.get("user")!.id, c.req.param("id"));
    if (!deleted) return c.json({ message: "Planned workout not found" }, 404);
    return c.json({ id: c.req.param("id"), deleted: true });
  });
