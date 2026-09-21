import type { InferRequestType, InferResponseType } from "hono/client";

import { apiClient } from "@/lib/api-client";

export type AthleteProfileResponse = InferResponseType<typeof apiClient.athlete.profile.$get>;
export type UpdateAthleteProfileResponse = InferResponseType<typeof apiClient.athlete.profile.$put>;
export type UpdateAthleteProfileInput = InferRequestType<
  typeof apiClient.athlete.profile.$put
>["json"];

/** Mirrors backend athlete zone payload (Hono does not infer jsonb shapes). */
export type AthleteZoneType = "hr" | "power" | "pace";
export type AthleteZoneRange = {
  min: number;
  max: number;
};
export type AthleteZonesResponse = Record<AthleteZoneType, AthleteZoneRange[]>;
export type UpdateAthleteZonesInput = {
  type: AthleteZoneType;
  zones: AthleteZoneRange[];
};

export async function fetchAthleteProfile(signal?: AbortSignal) {
  const res = await apiClient.athlete.profile.$get(undefined, { init: { signal } });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function updateAthleteProfile(input: UpdateAthleteProfileInput) {
  const res = await apiClient.athlete.profile.$put({ json: input });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json();
}

export async function fetchAthleteZones(signal?: AbortSignal): Promise<AthleteZonesResponse> {
  const res = await apiClient.athlete.zones.$get(undefined, { init: { signal } });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json() as Promise<AthleteZonesResponse>;
}

export async function updateAthleteZones(
  input: UpdateAthleteZonesInput,
): Promise<AthleteZonesResponse> {
  const res = await apiClient.athlete.zones.$put({ json: input });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return res.json() as Promise<AthleteZonesResponse>;
}
