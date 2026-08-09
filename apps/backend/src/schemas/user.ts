import * as z from "zod";

import { BetterAuthId$, Boolean$, Date$ } from "./base";

export const UserRole$ = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof UserRole$>;

export const User$ = z.object({
  id: BetterAuthId$,
  name: z.string().trim(),
  email: z.email(),
  emailVerified: Boolean$,
  image: z.url().nullish(),
  createdAt: Date$,
  updatedAt: Date$,
  role: UserRole$.default("user"),
  banned: Boolean$.nullish(),
  banReason: z.string().trim().nullish(),
  banExpires: Date$.nullish(),
});
export type User = z.infer<typeof User$>;

export const Session$ = z.object({
  id: BetterAuthId$,
  expiresAt: Date$,
  token: z.string().trim(),
  createdAt: Date$,
  updatedAt: Date$,
  ipAddress: z.string().trim().nullish(),
  userAgent: z.string().trim().nullish(),
  userId: BetterAuthId$,
  impersonatedBy: BetterAuthId$.nullish(),
});
export type Session = z.infer<typeof Session$>;
