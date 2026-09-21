import { queryOptions } from "@tanstack/react-query";

import { fetchAthleteProfile, fetchAthleteZones } from "@/lib/athlete-api";

export const athleteProfileQueryKey = ["athlete", "profile"] as const;
export const athleteZonesQueryKey = ["athlete", "zones"] as const;

export const athleteProfileQueryOptions = queryOptions({
  queryKey: athleteProfileQueryKey,
  queryFn: ({ signal }) => fetchAthleteProfile(signal),
});

export const athleteZonesQueryOptions = queryOptions({
  queryKey: athleteZonesQueryKey,
  queryFn: ({ signal }) => fetchAthleteZones(signal),
});
