import { sValidator } from "@hono/standard-validator";
import {
  createPlannedWorkoutInputSchema$,
  listPlannedWorkoutsInputSchema$,
  listPlannedWorkoutsOutputSchema$,
  updatePlannedWorkoutInputSchema$,
} from "@repo/ai";
import { Hono } from "hono";
import * as z from "zod";

import { isAuthenticated } from "@/middlewares/use-auth";
import {
  createPlannedWorkout,
  deletePlannedWorkout,
  getPlannedWorkouts,
  updatePlannedWorkout,
} from "@/services/planned-workouts";
import { isPlannedWorkoutRangeWithinLimit } from "@/services/planned-workouts-range";

const querySchema = listPlannedWorkoutsInputSchema$.refine(
  ({ from, to }) => to === undefined || isPlannedWorkoutRangeWithinLimit(from, to),
);
const idParamSchema$ = z.object({ id: z.string().trim().min(1) });
const updateBodySchema$ = updatePlannedWorkoutInputSchema$.omit({ id: true });

export const plannedWorkoutRoutes = new Hono()
  .use(isAuthenticated)
  .get("/", sValidator("query", querySchema), async (c) =>
    c.json(
      listPlannedWorkoutsOutputSchema$.parse(
        await getPlannedWorkouts(c.get("user")!.id, c.req.valid("query")),
      ),
    ),
  )
  .post("/", sValidator("json", createPlannedWorkoutInputSchema$), async (c) => {
    const workout = await createPlannedWorkout(c.get("user")!.id, c.req.valid("json"));
    return c.json({ workout }, 201);
  })
  .patch(
    "/:id",
    sValidator("param", idParamSchema$),
    sValidator("json", updateBodySchema$),
    async (c) => {
      const workout = await updatePlannedWorkout(c.get("user")!.id, {
        id: c.req.valid("param").id,
        ...c.req.valid("json"),
      });
      if (!workout) return c.json({ message: "Planned workout not found" }, 404);
      return c.json({ workout });
    },
  )
  .delete("/:id", sValidator("param", idParamSchema$), async (c) => {
    const { id } = c.req.valid("param");
    const deleted = await deletePlannedWorkout(c.get("user")!.id, id);
    if (!deleted) return c.json({ message: "Planned workout not found" }, 404);
    return c.json({ id, deleted: true });
  });
