import type { AthleteZoneRange } from "@/lib/athlete-api";

/** Coggan power zones as fractions of FTP (Allen & Coggan). */
const POWER_ZONE_BOUNDS = [0, 0.55, 0.75, 0.9, 1.05, 1.2, 1.5] as const;

/** Friel HR zones as fractions of LTHR. */
const HR_ZONE_BOUNDS = [0, 0.81, 0.89, 0.94, 0.99, 1.02, 1.06] as const;

/** Pace zones as fractions of threshold pace (faster = higher zone, higher m/s). */
const PACE_ZONE_BOUNDS = [0.75, 0.85, 0.92, 0.98, 1.03, 1.1, 1.2] as const;

function rangesFromBounds(
  anchor: number,
  bounds: readonly number[],
  round: boolean,
): AthleteZoneRange[] {
  const zones: AthleteZoneRange[] = [];

  for (let i = 0; i < bounds.length - 1; i++) {
    const minRaw = anchor * bounds[i]!;
    const maxRaw = anchor * bounds[i + 1]!;
    zones.push({
      min: round ? Math.round(minRaw) : Number(minRaw.toFixed(3)),
      max: round ? Math.round(maxRaw) : Number(maxRaw.toFixed(3)),
    });
  }

  return zones;
}

export function defaultHrZones(lthr: number): AthleteZoneRange[] {
  return rangesFromBounds(lthr, HR_ZONE_BOUNDS, true);
}

export function defaultPowerZones(ftp: number): AthleteZoneRange[] {
  return rangesFromBounds(ftp, POWER_ZONE_BOUNDS, true);
}

/**
 * Pace zones in m/s (same unit as thresholdPaceMps).
 * Higher zone = faster pace = higher m/s.
 */
export function defaultPaceZones(thresholdPaceMps: number): AthleteZoneRange[] {
  return rangesFromBounds(thresholdPaceMps, PACE_ZONE_BOUNDS, false);
}
