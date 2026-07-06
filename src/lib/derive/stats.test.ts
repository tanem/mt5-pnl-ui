import { describe, expect, test } from "vitest";
import { computeStats, dealNet } from "./stats";
import { deal } from "../../../tests/helpers/fixture";

test("dealNet sums profit, swap, commission, fee with native signs", () => {
  expect(
    dealNet(deal({ profit: 10, swap: -0.2, commission: -0.5, fee: -0.1 })),
  ).toBeCloseTo(9.2);
});

describe("computeStats", () => {
  const wins = [
    deal({ profit: 10, commission: -1 }), // net +9
    deal({ profit: 5 as number, commission: -0.5 }), // net +4.5 (fixture commission overridden)
  ];
  const loss = deal({ profit: -6, commission: -1 }); // net -7
  const breakeven = deal({ profit: 0.5, commission: -0.5 }); // net 0

  test("counts, components, and rates", () => {
    const s = computeStats([...wins, loss, breakeven]);
    expect(s.trades).toBe(4);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.breakevens).toBe(1);
    expect(s.netPnl).toBeCloseTo(9 + 4.5 - 7 + 0);
    expect(s.tradeProfit).toBeCloseTo(10 + 5 - 6 + 0.5);
    expect(s.commission).toBeCloseTo(-3);
    expect(s.costs).toBeCloseTo(-3); // swap and fee are 0 in fixtures
    expect(s.winRate).toBeCloseTo(2 / 4); // wins / trades, breakeven dilutes
    expect(s.profitFactor).toBeCloseTo((9 + 4.5) / 7);
    expect(s.avgWin).toBeCloseTo((9 + 4.5) / 2);
    expect(s.avgLoss).toBeCloseTo(-7); // signed negative
  });

  test("empty and undecided selections yield nulls, not NaN", () => {
    const empty = computeStats([]);
    expect(empty.trades).toBe(0);
    expect(empty.netPnl).toBe(0);
    expect(empty.winRate).toBeNull();
    expect(empty.profitFactor).toBeNull();
    expect(empty.avgWin).toBeNull();
    expect(empty.avgLoss).toBeNull();

    const noLosses = computeStats(wins);
    expect(noLosses.profitFactor).toBeNull(); // gross loss 0 → null, never Infinity
    expect(noLosses.avgLoss).toBeNull();
  });
});
