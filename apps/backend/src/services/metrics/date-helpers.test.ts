import { describe, expect, test } from "bun:test";

import { filterSeriesFromDate, pickEarliestDate } from "./date-helpers";

describe("pickEarliestDate", () => {
  test("returns null for empty input", () => {
    expect(pickEarliestDate([])).toBeNull();
  });

  test("returns earliest calendar date", () => {
    expect(pickEarliestDate(["2025-03-10", "2025-01-01", "2025-02-15"])).toBe("2025-01-01");
  });
});

describe("filterSeriesFromDate", () => {
  test("returns full series when fromDate is omitted", () => {
    const series = [
      { date: "2025-01-01", value: 1 },
      { date: "2025-01-02", value: 2 },
    ];

    expect(filterSeriesFromDate(series)).toHaveLength(2);
  });

  test("filters rows on or after fromDate", () => {
    const series = [
      { date: "2025-01-01", value: 1 },
      { date: "2025-01-02", value: 2 },
      { date: "2025-01-03", value: 3 },
    ];

    expect(filterSeriesFromDate(series, "2025-01-02")).toEqual([
      { date: "2025-01-02", value: 2 },
      { date: "2025-01-03", value: 3 },
    ]);
  });
});
