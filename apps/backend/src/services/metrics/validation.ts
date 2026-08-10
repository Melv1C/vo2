import type { LoadSource, SportFamily, SportPayload } from "./types";

export function validateSportLoadGating(input: {
  sportFamily: SportFamily;
  loadSource: LoadSource | null;
  sportPayload: SportPayload | null;
}): string[] {
  const violations: string[] = [];

  if (input.sportFamily === "running" && input.loadSource === "tss") {
    violations.push("running_activity_used_power_tss");
  }

  if (
    (input.sportFamily === "walking" || input.sportFamily === "other") &&
    (input.loadSource === "tss" || input.loadSource === "r_tss")
  ) {
    violations.push("non_run_activity_used_sport_specific_load");
  }

  if (input.sportFamily === "running" && input.sportPayload && "np" in input.sportPayload) {
    violations.push("running_activity_has_cycling_payload");
  }

  return violations;
}
