/** Bump when formulas or sanitizer logic change; stale rows recompute on explicit request. */
export const METRICS_VERSION = 2;

export type SportFamily = "cycling" | "running" | "swimming" | "walking" | "other";

/** Source used for the final training load value on an activity. */
export type LoadSource = "tss" | "r_tss" | "s_tss" | "hr_tss" | "trimp_equiv";

export type AnchorSource = "manual" | "estimated";

export type AthleteSex = "M" | "F";

/** Stream sanitization quality report persisted with each activity's metrics. */
export type DataQualityReport = {
  samplesIn: number;
  samplesDropped: number;
  segments: number;
  longestGapS: number;
  /** Median sample interval (seconds). */
  nominalDtS: number;
  coveragePct: number;
  movingTimeS: number;
};

export type SanitizedSample = {
  timeS: number;
  deltaS: number;
  hr: number | null;
  power: number | null;
  cadence: number | null;
  velocityMps: number | null;
  altitudeM: number | null;
  distanceM: number | null;
  gradePct: number | null;
  moving: boolean;
};

export type SanitizedSegment = {
  samples: SanitizedSample[];
};

export type SanitizedStream = {
  segments: SanitizedSegment[];
  quality: DataQualityReport;
};

/** Parallel arrays as stored in activity_streams — no DB import in compute layer. */
export type RawStreamInput = {
  timeS: number[] | null;
  distanceM: number[] | null;
  altitudeM: number[] | null;
  velocityMps: number[] | null;
  heartrate: number[] | null;
  cadence: number[] | null;
  watts: number[] | null;
  moving: boolean[] | null;
  gradePct: number[] | null;
};

/** Snapshot of athlete anchors at compute time — persisted for reproducibility. */
export type AnchorSnapshot = {
  maxHr: number | null;
  restingHr: number | null;
  lthr: number | null;
  ftp: number | null;
  thresholdPaceMps: number | null;
  /** Critical Swim Speed (CSS) in m/s. */
  thresholdSwimPaceMps: number | null;
  weightKg: number | null;
  sex: AthleteSex | null;
};

/** Athlete profile values used during metrics computation. */
export type AthleteContext = {
  userId: string;
  maxHr: number | null;
  restingHr: number | null;
  lthr: number | null;
  ftp: number | null;
  thresholdPaceMps: number | null;
  /** Critical Swim Speed (CSS) in m/s. */
  thresholdSwimPaceMps: number | null;
  weightKg: number | null;
  heightCm: number | null;
  birthdate: string | null;
  sex: AthleteSex | null;
};

export type TimeInZone = {
  zone: number;
  seconds: number;
};

/** Cross-check diagnostics stored with activity metrics. */
export type CrossCheckResult = {
  tssVsHrtssPct: number | null;
  rtssVsHrtssPct: number | null;
  stssVsHrtssPct: number | null;
  banisterVsEdwardsPct: number | null;
  decouplingSanity: boolean;
  coverageOk: boolean;
  downgraded: boolean;
};

/** Cycling-specific metrics stored in sport_payload jsonb. */
export type CyclingPayload = {
  np: number;
  intensityFactor: number;
  tss: number;
  variabilityIndex: number;
  workKj: number;
  wattsPerKg: number;
};

/** Running-specific metrics stored in sport_payload jsonb. */
export type RunningPayload = {
  ngpMps: number;
  runIntensityFactor: number;
  rTss: number;
  efficiencyIndex: number;
  avgCadence: number | null;
};

/** Swimming-specific metrics stored in sport_payload jsonb. */
export type SwimmingPayload = {
  nspMps: number;
  swimIntensityFactor: number;
  sTss: number;
  efficiencyIndex: number;
  avgCadence: number | null;
};

export type SportPayload = CyclingPayload | RunningPayload | SwimmingPayload;

export type SportModuleResult = {
  sportPayload?: SportPayload | null;
  energyKcal?: number | null;
  decouplingPct?: number | null;
};

export type SportComputeContext = {
  stream: SanitizedStream;
  athlete: AthleteContext;
  sportFamily: SportFamily;
  deviceWatts: boolean;
};

export type SportModule = {
  family: SportFamily;
  canCompute: (ctx: SportComputeContext) => boolean;
  compute: (ctx: SportComputeContext) => SportModuleResult;
};

export type UniversalMetricsResult = {
  trimpBanister: number | null;
  trimpEdwards: number | null;
  hrTss: number | null;
  avgHr: number | null;
  maxHr: number | null;
  movingTimeS: number;
  decouplingPct: number | null;
  timeInZone: TimeInZone[];
};

export type UniversalComputeContext = {
  stream: SanitizedStream;
  athlete: AthleteContext;
};

export type UniversalModule = {
  compute: (ctx: UniversalComputeContext) => UniversalMetricsResult;
};
