/** Convert meters/second to total seconds per kilometer. */
export function mpsToSecPerKm(mps: number): number {
  if (mps <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return 1000 / mps;
}

/** Convert meters/second to total seconds per 100 meters (swim). */
export function mpsToSecPer100m(mps: number): number {
  if (mps <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return 100 / mps;
}

export function secPerKmToMps(secPerKm: number): number {
  if (secPerKm <= 0) {
    return 0;
  }
  return 1000 / secPerKm;
}

export function secPer100mToMps(secPer100m: number): number {
  if (secPer100m <= 0) {
    return 0;
  }
  return 100 / secPer100m;
}

/** Format seconds as `m:ss` (or `mm:ss` when >= 10 minutes). */
export function formatPaceClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "";
  }

  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Parse `m:ss` or `mm:ss` (also plain seconds) into total seconds.
 * Returns null when empty or invalid.
 */
export function parsePaceClock(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  }

  const match = /^(\d+):([0-5]?\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

export function mpsToRunPaceInput(mps: number | null | undefined): string {
  if (mps == null || mps <= 0) {
    return "";
  }
  return formatPaceClock(mpsToSecPerKm(mps));
}

export function mpsToSwimPaceInput(mps: number | null | undefined): string {
  if (mps == null || mps <= 0) {
    return "";
  }
  return formatPaceClock(mpsToSecPer100m(mps));
}

export function runPaceInputToMps(value: string): number | null {
  const sec = parsePaceClock(value);
  if (sec == null) {
    return null;
  }
  return secPerKmToMps(sec);
}

export function swimPaceInputToMps(value: string): number | null {
  const sec = parsePaceClock(value);
  if (sec == null) {
    return null;
  }
  return secPer100mToMps(sec);
}
