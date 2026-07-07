import { expect, test } from "vitest";
import { computeAccountReturns, groupReturnsByCurrency } from "./returns";
import { account, deal, flow } from "../../../tests/helpers/fixture";

test("classifies balance deals by sign and derives identity-based profit", () => {
  // The spec's worked example: deposited 10,000; withdrawn 4,000;
  // balance 9,000; floating 500 → profit 3,500 → gain 35%.
  const r = computeAccountReturns(
    account({ balance: 9000, equity: 9500 }),
    [flow({ profit: 10000 }), flow({ profit: -4000 })],
    [],
  );
  expect(r.deposits).toBe(10000);
  expect(r.withdrawals).toBe(4000);
  expect(r.floating).toBe(500);
  expect(r.profit).toBe(3500);
  expect(r.gainPct).toBeCloseTo(0.35);
});

test("non-balance types are adjustments, never deposits or withdrawals", () => {
  const r = computeAccountReturns(
    account({ balance: 1050, equity: 1050 }),
    [flow({ profit: 1000 }), flow({ type: 6, profit: 50 })], // bonus
    [],
  );
  expect(r.deposits).toBe(1000);
  expect(r.adjustments).toBe(50);
  expect(r.profit).toBe(50); // the bonus is gain the holder did not deposit
});

test("gainPct is null when there are no deposits", () => {
  const r = computeAccountReturns(account(), [], []);
  expect(r.gainPct).toBeNull();
});

test("reconciliation holds at the 0.01 tolerance and fails beyond it", () => {
  const flows = [flow({ profit: 10000 }), flow({ profit: -4000 })];
  const deals = [deal({ profit: 3000, commission: 0 })];
  // deposits − withdrawals + adjustments + Σ dealNet = 9,000
  expect(
    computeAccountReturns(account({ balance: 9000.01, equity: 9000.01 }), flows, deals)
      .reconciles,
  ).toBe(true);
  expect(
    computeAccountReturns(account({ balance: 9000.02, equity: 9000.02 }), flows, deals)
      .reconciles,
  ).toBe(false);
});

test("ignores flows and deals belonging to other accounts", () => {
  const r = computeAccountReturns(
    account({ login: 111, balance: 1000, equity: 1000 }),
    [flow({ account: 111, profit: 1000 }), flow({ account: 222, profit: 5000 })],
    [deal({ account: 222, profit: 99 })],
  );
  expect(r.deposits).toBe(1000);
  expect(r.reconciles).toBe(true);
});

test("groups by currency with summed totals and a group gain", () => {
  const accounts = [
    account({ login: 111, currency: "USD", balance: 1100, equity: 1100 }),
    account({ login: 222, currency: "USD", balance: 900, equity: 900 }),
    account({ login: 333, currency: "EUR", balance: 500, equity: 500 }),
  ];
  const flows = [
    flow({ account: 111, profit: 1000 }),
    flow({ account: 222, profit: 1000 }),
    flow({ account: 333, profit: 400 }),
  ];
  const groups = groupReturnsByCurrency(accounts, flows, [], null);
  expect([...groups.keys()].sort()).toEqual(["EUR", "USD"]);
  const usd = groups.get("USD")!;
  expect(usd.accounts).toHaveLength(2);
  expect(usd.totals.deposits).toBe(2000);
  expect(usd.totals.profit).toBe(0); // +100 and −100
  expect(usd.totals.gainPct).toBe(0);
  expect(groups.get("EUR")!.totals.gainPct).toBeCloseTo(0.25);
});

test("account filter: null means all, [] means none, list selects", () => {
  const accounts = [
    account({ login: 111, currency: "USD" }),
    account({ login: 222, currency: "EUR" }),
  ];
  expect(groupReturnsByCurrency(accounts, [], [], null).size).toBe(2);
  expect(groupReturnsByCurrency(accounts, [], [], []).size).toBe(0);
  const only = groupReturnsByCurrency(accounts, [], [], [222]);
  expect([...only.keys()]).toEqual(["EUR"]);
});
