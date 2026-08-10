import { eq } from "drizzle-orm";

import { db } from "@/database";
import { athleteProfile } from "@/database/entities/athlete-profile";
import { getWeightKgAtDate } from "@/services/athlete/body-metrics";
import type { AthleteContext, AthleteSex } from "@/services/metrics/types";

function parseSex(value: string | null): AthleteSex | null {
  if (value === "M" || value === "F") {
    return value;
  }
  return null;
}

export async function loadAthleteContext(userId: string, at: Date = new Date()): Promise<AthleteContext> {
  const [profile] = await db.select().from(athleteProfile).where(eq(athleteProfile.userId, userId));

  const weightKg = await getWeightKgAtDate(userId, at);

  return {
    userId,
    maxHr: profile?.maxHr ?? null,
    restingHr: profile?.restingHr ?? null,
    lthr: profile?.lthr ?? null,
    ftp: profile?.ftp ?? null,
    thresholdPaceMps: profile?.thresholdPaceMps ?? null,
    weightKg,
    heightCm: profile?.heightCm ?? null,
    birthdate: profile?.birthdate ?? null,
    sex: parseSex(profile?.sex ?? null),
  };
}
