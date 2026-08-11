import type { RawStreamInput } from "./types";

type StreamArrays = {
  timeS?: number[] | null;
  distanceM?: number[] | null;
  altitudeM?: number[] | null;
  velocityMps?: number[] | null;
  heartrate?: number[] | null;
  cadence?: number[] | null;
  watts?: number[] | null;
  moving?: boolean[] | null;
  gradePct?: number[] | null;
};

/** Builds a complete RawStreamInput for tests with unspecified arrays defaulting to null. */
export function testRawStreamInput(input: StreamArrays): RawStreamInput {
  return {
    timeS: input.timeS ?? null,
    distanceM: input.distanceM ?? null,
    altitudeM: input.altitudeM ?? null,
    velocityMps: input.velocityMps ?? null,
    heartrate: input.heartrate ?? null,
    cadence: input.cadence ?? null,
    watts: input.watts ?? null,
    moving: input.moving ?? null,
    gradePct: input.gradePct ?? null,
  };
}
