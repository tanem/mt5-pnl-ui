import { describe, expect, test } from "vitest";
import {
  bucketByDayUTC,
  bucketByMonthUTC,
  dayKeyUTC,
  monthKeyUTC,
} from "./buckets";
import { deal } from "../../../tests/helpers/fixture";

// 2025-06-30T23:59:50Z and 2025-07-01T00:00:10Z — straddle a UTC month edge
const JUN_30 = 1751327990;
const JUL_01 = 1751328010;

test("keys are UTC, not local", () => {
  expect(dayKeyUTC(JUN_30)).toBe("2025-06-30");
  expect(dayKeyUTC(JUL_01)).toBe("2025-07-01");
  expect(monthKeyUTC(JUN_30)).toBe("2025-06");
  expect(monthKeyUTC(JUL_01)).toBe("2025-07");
});

describe("bucketing", () => {
  const deals = [
    deal({ time: JUN_30, profit: 10, commission: 0 }),
    deal({ time: JUN_30, profit: -4, commission: 0 }),
    deal({ time: JUL_01, profit: 2, commission: 0 }),
  ];

  test("by day: net and trade count per UTC day", () => {
    const days = bucketByDayUTC(deals);
    expect(days.get("2025-06-30")).toEqual({ net: 6, trades: 2 });
    expect(days.get("2025-07-01")).toEqual({ net: 2, trades: 1 });
    expect(days.size).toBe(2);
  });

  test("by month: straddling deals land in their UTC month", () => {
    const months = bucketByMonthUTC(deals);
    expect(months.get("2025-06")).toEqual({ net: 6, trades: 2 });
    expect(months.get("2025-07")).toEqual({ net: 2, trades: 1 });
  });

  test("empty input gives an empty map", () => {
    expect(bucketByDayUTC([]).size).toBe(0);
  });
});
