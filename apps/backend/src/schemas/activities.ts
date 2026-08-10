import * as z from "zod";

export const streamsSinceBody$ = z.object({
  streamsSince: z.iso.datetime(),
});

export type StreamsSinceBody = z.infer<typeof streamsSinceBody$>;
