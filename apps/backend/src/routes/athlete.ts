import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { db } from "@/database";
import {
  athleteProfile,
  athleteZones,
  type AthleteZoneType,
} from "@/database/entities/athlete-profile";
import { isAuthenticated } from "@/middlewares/use-auth";
import {
  type AthleteProfileResponse,
  type AthleteZonesResponse,
  updateAthleteProfile$,
  updateAthleteZones$,
} from "@/schemas/athlete";
import {
  appendWeightSample,
  computeBmi,
  computeBsa,
} from "@/services/athlete/body-metrics";
import { estimateAnchorsFromHistory } from "@/services/athlete/estimate-anchors";
import type { AnchorSource } from "@/services/metrics/types";

const ANCHOR_FIELDS = ["maxHr", "restingHr", "lthr", "ftp", "thresholdPaceMps"] as const;

function toProfileResponse(
  profile: typeof athleteProfile.$inferSelect,
): AthleteProfileResponse {
  const bmi =
    profile.weightKg != null && profile.heightCm != null
      ? Number(computeBmi(profile.weightKg, profile.heightCm).toFixed(2))
      : null;
  const bsa =
    profile.weightKg != null && profile.heightCm != null
      ? Number(computeBsa(profile.weightKg, profile.heightCm).toFixed(3))
      : null;

  return {
    athleteCreatedAt: profile.athleteCreatedAt?.toISOString() ?? null,
    sex: profile.sex,
    birthdate: profile.birthdate,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    restingHr: profile.restingHr,
    maxHr: profile.maxHr,
    maxHrSource: profile.maxHrSource ?? null,
    lthr: profile.lthr,
    lthrSource: profile.lthrSource ?? null,
    ftp: profile.ftp,
    ftpSource: profile.ftpSource ?? null,
    thresholdPaceMps: profile.thresholdPaceMps,
    thresholdPaceSource: profile.thresholdPaceSource ?? null,
    bmi,
    bsa,
  };
}

function emptyZonesResponse(): AthleteZonesResponse {
  return {
    hr: [],
    power: [],
    pace: [],
  };
}

async function ensureProfile(userId: string): Promise<typeof athleteProfile.$inferSelect> {
  const [existing] = await db.select().from(athleteProfile).where(eq(athleteProfile.userId, userId));

  if (existing) {
    return existing;
  }

  const [created] = await db.insert(athleteProfile).values({ userId }).returning();
  return created!;
}

function anchorsChanged(
  before: typeof athleteProfile.$inferSelect,
  after: typeof athleteProfile.$inferSelect,
): boolean {
  return ANCHOR_FIELDS.some((field) => before[field] !== after[field]);
}

export const athleteRoutes = new Hono()
  .use(isAuthenticated)
  .get("/profile", async (c) => {
    const userId = c.get("user")!.id;
    const profile = await ensureProfile(userId);
    return c.json(toProfileResponse(profile));
  })
  .put("/profile", async (c) => {
    const userId = c.get("user")!.id;
    const body = updateAthleteProfile$.parse(await c.req.json());
    const before = await ensureProfile(userId);

    const update: Partial<typeof athleteProfile.$inferInsert> = {};

    if (body.sex !== undefined) {
      update.sex = body.sex;
    }
    if (body.birthdate !== undefined) {
      update.birthdate = body.birthdate;
    }
    if (body.heightCm !== undefined) {
      update.heightCm = body.heightCm;
    }
    if (body.weightKg !== undefined) {
      update.weightKg = body.weightKg;
    }
    if (body.restingHr !== undefined) {
      update.restingHr = body.restingHr;
    }
    if (body.maxHr !== undefined) {
      update.maxHr = body.maxHr;
      update.maxHrSource = "manual" satisfies AnchorSource;
    }
    if (body.lthr !== undefined) {
      update.lthr = body.lthr;
      update.lthrSource = "manual" satisfies AnchorSource;
    }
    if (body.ftp !== undefined) {
      update.ftp = body.ftp;
      update.ftpSource = "manual" satisfies AnchorSource;
    }
    if (body.thresholdPaceMps !== undefined) {
      update.thresholdPaceMps = body.thresholdPaceMps;
      update.thresholdPaceSource = "manual" satisfies AnchorSource;
    }

    const [after] = await db
      .update(athleteProfile)
      .set(update)
      .where(eq(athleteProfile.userId, userId))
      .returning();

    if (body.weightKg != null && body.weightKg !== before.weightKg) {
      await appendWeightSample(userId, body.weightKg);
    }

    return c.json({
      ...toProfileResponse(after!),
      anchorsChanged: anchorsChanged(before, after!),
    });
  })
  .post("/profile/estimate", async (c) => {
    const userId = c.get("user")!.id;
    await ensureProfile(userId);
    const estimates = await estimateAnchorsFromHistory(userId);
    return c.json(estimates);
  })
  .get("/zones", async (c) => {
    const userId = c.get("user")!.id;
    const rows = await db.select().from(athleteZones).where(eq(athleteZones.userId, userId));

    const response = emptyZonesResponse();
    for (const row of rows) {
      response[row.type as AthleteZoneType] = row.zones;
    }

    return c.json(response);
  })
  .put("/zones", async (c) => {
    const userId = c.get("user")!.id;
    const body = updateAthleteZones$.parse(await c.req.json());

    const [row] = await db
      .insert(athleteZones)
      .values({
        userId,
        type: body.type,
        zones: body.zones,
      })
      .onConflictDoUpdate({
        target: [athleteZones.userId, athleteZones.type],
        set: {
          zones: body.zones,
          updatedAt: new Date(),
        },
      })
      .returning();

    const response = emptyZonesResponse();
    response[row!.type as AthleteZoneType] = row!.zones;
    return c.json(response);
  });
