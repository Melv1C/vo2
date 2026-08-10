/** Strava read rate limits (per app). */
export const READ_LIMIT_15MIN = 200;
export const READ_LIMIT_DAILY = 2_000;
/** Stop before hitting the ceiling to leave headroom for retries. */
const HEADROOM = 5;

/** Shared across all sync runs so we don't blast the API between polls. */
let sharedLimiter: StravaRateLimiter | null = null;

export function getSharedRateLimiter(): StravaRateLimiter {
  if (!sharedLimiter) {
    sharedLimiter = new StravaRateLimiter();
  }
  return sharedLimiter;
}

type WindowState = {
  limit: number;
  usage: number;
  resetAtMs: number;
};

function parseHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (value == null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tracks Strava read rate-limit headers and throttles before requests.
 *
 * Headers: X-ReadRateLimit-Limit, X-ReadRateLimit-Usage,
 *          X-ReadRateLimit-Reset (epoch seconds).
 */
export class StravaRateLimiter {
  private shortTerm: WindowState = {
    limit: READ_LIMIT_15MIN,
    usage: 0,
    resetAtMs: 0,
  };

  private daily: WindowState = {
    limit: READ_LIMIT_DAILY,
    usage: 0,
    resetAtMs: 0,
  };

  updateFromHeaders(headers: Headers): void {
    const shortLimit = parseHeader(headers, "X-ReadRateLimit-Limit");
    const shortUsage = parseHeader(headers, "X-ReadRateLimit-Usage");
    const shortReset = parseHeader(headers, "X-ReadRateLimit-Reset");

    if (shortLimit != null) {
      this.shortTerm.limit = shortLimit;
    }
    if (shortUsage != null) {
      this.shortTerm.usage = shortUsage;
    }
    if (shortReset != null) {
      this.shortTerm.resetAtMs = shortReset * 1_000;
    }

    const dailyLimit = parseHeader(headers, "X-RateLimit-Limit");
    const dailyUsage = parseHeader(headers, "X-RateLimit-Usage");
    const dailyReset = parseHeader(headers, "X-RateLimit-Reset");

    if (dailyLimit != null) {
      this.daily.limit = dailyLimit;
    }
    if (dailyUsage != null) {
      this.daily.usage = dailyUsage;
    }
    if (dailyReset != null) {
      this.daily.resetAtMs = dailyReset * 1_000;
    }
  }

  get isNearLimit(): boolean {
    return (
      this.shortTerm.usage >= this.shortTerm.limit - HEADROOM ||
      this.daily.usage >= this.daily.limit - HEADROOM
    );
  }

  get isExhausted(): boolean {
    return this.shortTerm.usage >= this.shortTerm.limit || this.daily.usage >= this.daily.limit;
  }

  /** Wait until the nearest rate-limit window resets. */
  async waitForReset(): Promise<void> {
    const now = Date.now();
    const waits: number[] = [];

    if (this.shortTerm.usage >= this.shortTerm.limit - HEADROOM && this.shortTerm.resetAtMs > now) {
      waits.push(this.shortTerm.resetAtMs - now + 1_000);
    }
    if (this.daily.usage >= this.daily.limit - HEADROOM && this.daily.resetAtMs > now) {
      waits.push(this.daily.resetAtMs - now + 1_000);
    }

    if (waits.length === 0) {
      return;
    }

    await sleep(Math.min(...waits));
  }

  /** Block until there is budget for at least one read request. */
  async acquire(): Promise<void> {
    if (!this.isNearLimit) {
      return;
    }
    await this.waitForReset();
  }
}
