/** Bump when formulas or sanitizer logic change; stale rows recompute on explicit request. */
export const METRICS_VERSION = 1;

export type SportFamily = "cycling" | "running" | "walking" | "other";

export type LoadSource = "tss" | "r_tss" | "hr_tss" | "trimp_equiv";

export type AnchorSource = "manual" | "estimated";

export type AthleteSex = "M" | "F";

export type DataQualityReport = {
  samplesIn: number;
  samplesDropped: number;
  segments: number;
  longestGapS: number;
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

export type AnchorSnapshot = {
  maxHr: number | null;
  restingHr: number | null;
  lthr: number | null;
  ftp: number | null;
  thresholdPaceMps: number | null;
  weightKg: number | null;
  sex: AthleteSex | null;
};

export type AthleteContext = {
  userId: string;
  maxHr: number | null;
  restingHr: number | null;
  lthr: number | null;
  ftp: number | null;
  thresholdPaceMps: number | null;
  weightKg: number | null;
  heightCm: number | null;
  birthdate: string | null;
  sex: AthleteSex | null;
};

export type TimeInZone = {
  zone: number;
  seconds: number;
};

export type CrossCheckResult = {
  tssVsHrtssPct: number | null;
  rtssVsHrtssPct: number | null;
  banisterVsEdwardsPct: number | null;
  decouplingSanity: boolean;
  coverageOk: boolean;
  downgraded: boolean;
};

export type CyclingPayload = {
  np: number;
  intensityFactor: number;
  tss: number;
  variabilityIndex: number;
  workKj: number;
  wattsPerKg: number;
};

export type RunningPayload = {
  ngpMps: number;
  runIntensityFactor: number;
  rTss: number;
  efficiencyIndex: number;
  avgCadence: number | null;
};

export type SportPayload = CyclingPayload | RunningPayload;

export type MetricResult = {
  sportFamily: SportFamily;
  trimpBanister: number | null;
  trimpEdwards: number | null;
  hrTss: number | null;
  avgHr: number | null;
  maxHr: number | null;
  movingTimeS: number;
  decouplingPct: number | null;
  timeInZone: TimeInZone[];
  energyKcal: number | null;
  weightKgUsed: number | null;
  trainingLoad: number | null;
  loadSource: LoadSource | null;
  sportPayload: SportPayload | null;
  dataQuality: DataQualityReport;
  crossChecks: CrossCheckResult | null;
  anchorSnapshot: AnchorSnapshot;
};

export type SportComputeContext = {
  stream: SanitizedStream;
  athlete: AthleteContext;
  sportFamily: SportFamily;
  deviceWatts: boolean;
};

export type SportModuleResult = Partial<
  Pick<MetricResult, "sportPayload" | "energyKcal" | "decouplingPct">
>;

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
