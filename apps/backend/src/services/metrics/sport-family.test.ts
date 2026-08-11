import { describe, expect, test } from "bun:test";

import { resolveSportFamily } from "./sport-family";

describe("resolveSportFamily", () => {
  test("maps Strava sport types to families", () => {
    expect(resolveSportFamily("Ride")).toBe("cycling");
    expect(resolveSportFamily("VirtualRide")).toBe("cycling");
    expect(resolveSportFamily("Run")).toBe("running");
    expect(resolveSportFamily("TrailRun")).toBe("running");
    expect(resolveSportFamily("Walk")).toBe("walking");
    expect(resolveSportFamily("Hike")).toBe("walking");
    expect(resolveSportFamily("Swim")).toBe("swimming");
    expect(resolveSportFamily(null)).toBe("other");
  });
});
