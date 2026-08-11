/** Returns the earliest calendar date from a list, or null when empty. */
export function pickEarliestDate(dates: string[]): string | null {
  if (dates.length === 0) {
    return null;
  }
  return [...dates].sort((left, right) => left.localeCompare(right))[0]!;
}

/** Filters a daily load series to rows on or after `fromDate`. */
export function filterSeriesFromDate<T extends { date: string }>(
  series: T[],
  fromDate?: string,
): T[] {
  return fromDate ? series.filter((row) => row.date >= fromDate) : series;
}
