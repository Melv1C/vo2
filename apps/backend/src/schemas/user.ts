import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";

import { user } from "@/database/entities/auth";

export const userRole$ = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof userRole$>;

export const user$ = createSelectSchema(user, {
  role: userRole$,
});
export type User = z.infer<typeof user$>;
