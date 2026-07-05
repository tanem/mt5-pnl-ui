import { describe, expect, test } from "vitest";
import { equityCurve, maxDrawdown } from "./equity";
import { deal } from "../../../tests/helpers/fixture";

function d(timeMsc: number, profit: number) {
  return deal({
    time_msc: timeMsc,
    time: Math.floor(timeMsc / 1000),
    profit,
    commission: 0,
  });
}

describe("equityCurve", () => {
  test("accumulates net P&L in time order without mutating input", () => {
    const deals = [d(3000, -5), d(1000, 10), d(2000, 2)];
    const copy = [...deals];
    const curve = equityCurve(deals);
    expect(curve).toEqual([
      { timeMsc: 1000, cum: 10 },
      { timeMsc: 2000, cum: 12 },
      { timeMsc: 3000, cum: 7 },
    ]);
    expect(deals).toEqual(copy);
  });

  test("ties on time_msc break by ticket for a stable curve", () => {
    const a = deal({ time_msc: 1000, ticket: 2, profit: 1, commission: 0 });
    const b = deal({ time_msc: 1000, ticket: 1, profit: 2, commission: 0 });
    expect(equityCurve([a, b]).map((p) => p.cum)).toEqual([2, 3]);
  });
});

describe("maxDrawdown", () => {
  test("largest peak-to-trough fall, signed negative", () => {
    // cum: 10, 12, 4, 8, 3 → peak 12, trough 3 → -9
    const curve = equityCurve([
      d(1, 10),
      d(2, 2),
      d(3, -8),
      d(4, 4),
      d(5, -5),
    ]);
    expect(maxDrawdown(curve)).toBeCloseTo(-9);
  });

  test("accumulates from zero: an opening loss is a drawdown", () => {
    expect(maxDrawdown(equityCurve([d(1, -4), d(2, 1)]))).toBeCloseTo(-4);
  });

  test("monotonic rise and empty input give 0", () => {
    expect(maxDrawdown(equityCurve([d(1, 1), d(2, 2)]))).toBe(0);
    expect(maxDrawdown([])).toBe(0);
  });
});
