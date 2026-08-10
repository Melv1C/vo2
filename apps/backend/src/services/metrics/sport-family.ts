import type { SportFamily } from "./types";

const CYCLING_TYPES = new Set([
  "Ride",
  "VirtualRide",
  "MountainBikeRide",
  "EMountainBikeRide",
  "Velomobile",
  "Handcycle",
]);

const RUNNING_TYPES = new Set(["Run", "TrailRun"]);

const WALKING_TYPES = new Set(["Walk", "Hike"]);

/** Single mapping from Strava sport_type strings to sport families. */
export function resolveSportFamily(sportType: string | null | undefined): SportFamily {
  if (!sportType) {
    return "other";
  }

  if (CYCLING_TYPES.has(sportType)) {
    return "cycling";
  }
  if (RUNNING_TYPES.has(sportType)) {
    return "running";
  }
  if (WALKING_TYPES.has(sportType)) {
    return "walking";
  }

  return "other";
}
