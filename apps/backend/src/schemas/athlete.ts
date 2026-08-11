import * as z from "zod";

import type { AthleteZoneRange, AthleteZoneType } from "@/database/entities/athlete-profile";

export const anchorSource$ = z.enum(["manual", "estimated"]);
export type AnchorSourceSchema = z.infer<typeof anchorSource$>;

export const athleteSex$ = z.enum(["M", "F"]);

export const athleteZoneRange$ = z.object({
  min: z.number(),
  max: z.number(),
});

export const athleteZoneType$ = z.enum(["hr", "power", "pace"]);
export type AthleteZoneTypeSchema = z.infer<typeof athleteZoneType$>;

export const updateAthleteProfile$ = z
  .object({
    sex: athleteSex$.optional(),
    birthdate: z.iso.date().nullish(),
    heightCm: z.number().min(100).max(250).nullish(),
    weightKg: z.number().min(30).max(200).nullish(),
    restingHr: z.int().min(30).max(120).nullish(),
    maxHr: z.int().min(100).max(250).nullish(),
    lthr: z.int().min(100).max(220).nullish(),
    ftp: z.int().min(50).max(600).nullish(),
    thresholdPaceMps: z.number().min(1).max(10).nullish(),
    thresholdSwimPaceMps: z.number().min(0.4).max(3).nullish(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: "At least one field is required",
  });

export type UpdateAthleteProfileInput = z.infer<typeof updateAthleteProfile$>;

export const updateAthleteZones$ = z.object({
  type: athleteZoneType$,
  zones: z.array(athleteZoneRange$).max(10),
});

export type UpdateAthleteZonesInput = z.infer<typeof updateAthleteZones$>;

export type AthleteProfileResponse = {
  athleteCreatedAt: string | null;
  sex: string | null;
  birthdate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  restingHr: number | null;
  maxHr: number | null;
  maxHrSource: AnchorSourceSchema | null;
  lthr: number | null;
  lthrSource: AnchorSourceSchema | null;
  ftp: number | null;
  ftpSource: AnchorSourceSchema | null;
  thresholdPaceMps: number | null;
  thresholdPaceSource: AnchorSourceSchema | null;
  thresholdSwimPaceMps: number | null;
  thresholdSwimPaceSource: AnchorSourceSchema | null;
  bmi: number | null;
  bsa: number | null;
};

export type AthleteZonesResponse = Record<AthleteZoneType, AthleteZoneRange[]>;

export type UpdateAthleteProfileResponse = AthleteProfileResponse & {
  anchorsChanged: boolean;
};
