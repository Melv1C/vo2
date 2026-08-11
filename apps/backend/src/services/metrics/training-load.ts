export type DailyLoadInput = {
  /** Calendar date (YYYY-MM-DD). */
  date: string;
  /** Total training load for the day (TSS-equivalent units). */
  trainingLoad: number;
  activityCount: number;
};

export type DailyLoadOutput = DailyLoadInput & {
  /** Chronic Training Load — 42-day exponentially weighted average. */
  ctl: number;
  /** Acute Training Load — 7-day exponentially weighted average. */
  atl: number;
  /** Training Stress Balance — yesterday's CTL minus yesterday's ATL. */
  tsb: number;
  /** True for the first 42 days of the series (CTL still ramping). */
  isRamping: boolean;
};

const CTL_DAYS = 42;
const ATL_DAYS = 7;
const RAMPING_DAYS = 42;

function smoothingFactor(days: number): number {
  return 1 - Math.exp(-1 / days);
}

function addDays(date: string, amount: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

/**
 * Builds a continuous daily CTL/ATL/TSB series from sparse daily load inputs.
 * Fills calendar gaps with zero-load rest days. TSB uses previous day's CTL/ATL.
 * Source: Banister impulse-response model (CTL/ATL formulation per TrainingPeaks convention).
 */
export function buildDailyLoadSeries(dailyLoads: DailyLoadInput[]): DailyLoadOutput[] {
  if (dailyLoads.length === 0) {
    return [];
  }

  const loadByDate = new Map(dailyLoads.map((row) => [row.date, row]));
  const sortedDates = [...loadByDate.keys()].sort();
  const startDate = sortedDates[0]!;
  const endDate = sortedDates[sortedDates.length - 1]!;
  const timeline = enumerateDates(startDate, endDate);

  const ctlFactor = smoothingFactor(CTL_DAYS);
  const atlFactor = smoothingFactor(ATL_DAYS);

  let ctl = 0;
  let atl = 0;
  let previousCtl = 0;
  let previousAtl = 0;
  const output: DailyLoadOutput[] = [];

  for (let index = 0; index < timeline.length; index++) {
    const date = timeline[index]!;
    const row = loadByDate.get(date);
    const trainingLoad = row?.trainingLoad ?? 0;
    const activityCount = row?.activityCount ?? 0;

    ctl += (trainingLoad - ctl) * ctlFactor;
    atl += (trainingLoad - atl) * atlFactor;
    const tsb = previousCtl - previousAtl;

    output.push({
      date,
      trainingLoad,
      activityCount,
      ctl,
      atl,
      tsb,
      isRamping: index < RAMPING_DAYS,
    });

    previousCtl = ctl;
    previousAtl = atl;
  }

  return output;
}
