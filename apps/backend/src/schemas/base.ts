import * as z from "zod";

export const BetterAuthId$ = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{32}$/, "Invalid Better Auth ID format");
export type BetterAuthId = z.infer<typeof BetterAuthId$>;

// Not use coerce because it can lead to unexpected behavior in react hook forms
export const Date$ = z.union([z.date(), z.iso.datetime().transform((date) => new Date(date))]);
export type Date = z.infer<typeof Date$>;

export const Boolean$ = z.union([z.boolean(), z.stringbool()]);
export type Boolean = z.infer<typeof Boolean$>;
