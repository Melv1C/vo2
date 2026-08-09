import * as z from "zod";

import { BetterAuthId$ } from "./base";

export const LogLevel$ = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevel$>;

export const Method$ = z.string().trim().min(1);
export type Method = z.infer<typeof Method$>;

export const LogData$ = z.object({
  requestId: z.string().trim().nullish(),
  userId: BetterAuthId$.nullish(),
  method: Method$.nullish(),
  path: z.string().trim().nullish(),
  statusCode: z.number().nullish(),
  metadata: z.unknown().nullish(),
});
export type LogData = z.infer<typeof LogData$>;

export const LogContext$ = LogData$.pick({
  requestId: true,
  userId: true,
  method: true,
  path: true,
});
export type LogContext = z.infer<typeof LogContext$>;
