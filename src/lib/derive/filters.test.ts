import { describe, expect, test } from "vitest";
import {
  applyFilters,
  EMPTY_FILTERS,
  reconcileFilters,
  scopedMagics,
  scopedSymbols,
} from "./filters";
import { deal } from "../../../tests/helpers/fixture";

const T_JUN1 = Date.UTC(2025, 5, 1, 12) / 1000; // 2025-06-01T12:00Z
const T_JUN15 = Date.UTC(2025, 5, 15, 12) / 1000;
const T_JUL1 = Date.UTC(2025, 6, 1, 12) / 1000;

const rows = [
  deal({ account: 111, symbol: "EURUSD", magic: 100, time: T_JUN1 }),
  deal({ account: 111, symbol: "XAUUSD", magic: 200, time: T_JUN15 }),
  deal({ account: 222, symbol: "eurusd", magic: 100, time: T_JUL1 }),
];

describe("applyFilters", () => {
  test("EMPTY_FILTERS passes everything through", () => {
    expect(applyFilters(rows, EMPTY_FILTERS)).toEqual(rows);
  });

  test("accounts filter is a login allowlist", () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, accounts: [222] });
    expect(out.map((r) => r.account)).toEqual([222]);
  });

  test("symbol match is case-insensitive exact", () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, symbol: "EURUSD" });
    expect(out).toHaveLength(2);
  });

  test("magics is a multi-value allowlist: null all, [] none, list selects", () => {
    expect(applyFilters(rows, { ...EMPTY_FILTERS, magics: null })).toHaveLength(3);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, magics: [] })).toHaveLength(0);
    const out = applyFilters(rows, { ...EMPTY_FILTERS, magics: [200] });
    expect(out.map((r) => r.magic)).toEqual([200]);
    expect(
      applyFilters(rows, { ...EMPTY_FILTERS, magics: [100, 200] }),
    ).toHaveLength(3);
  });

  test("date range is UTC and inclusive on both ends", () => {
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      from: "2025-06-01",
      to: "2025-06-15",
    });
    expect(out.map((r) => r.time)).toEqual([T_JUN1, T_JUN15]);
  });

  test("filters combine with AND", () => {
    const out = applyFilters(rows, {
      ...EMPTY_FILTERS,
      accounts: [111],
      magics: [100],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.time).toBe(T_JUN1);
  });
});

// Account 111 trades magics 100/200; account 222 trades 200/300. Magic
// 200 is shared; 100 and 300 each exist in one account only.
const scopeRows = [
  deal({ account: 111, symbol: "EURUSD", magic: 100 }),
  deal({ account: 111, symbol: "XAUUSD", magic: 200 }),
  deal({ account: 222, symbol: "EURUSD", magic: 200 }),
  deal({ account: 222, symbol: "USDJPY", magic: 300 }),
];

describe("scoped option lists", () => {
  test("scopedMagics lists distinct magics of the selected accounts, sorted", () => {
    expect(scopedMagics(scopeRows, null)).toEqual([100, 200, 300]);
    expect(scopedMagics(scopeRows, [111])).toEqual([100, 200]);
    expect(scopedMagics(scopeRows, [222])).toEqual([200, 300]);
    expect(scopedMagics(scopeRows, [])).toEqual([]);
  });

  test("scopedSymbols lists distinct symbols of the selected accounts, sorted", () => {
    expect(scopedSymbols(scopeRows, null)).toEqual(["EURUSD", "USDJPY", "XAUUSD"]);
    expect(scopedSymbols(scopeRows, [222])).toEqual(["EURUSD", "USDJPY"]);
  });
});

describe("reconcileFilters", () => {
  test("null magics stays null", () => {
    const out = reconcileFilters(scopeRows, EMPTY_FILTERS, [111]);
    expect(out).toEqual({ accounts: [111], symbol: null, magics: null });
  });

  test("still-available selections survive, vanished ones are dropped", () => {
    const filters = { ...EMPTY_FILTERS, magics: [100, 200] };
    const out = reconcileFilters(scopeRows, filters, [222]);
    // 100 vanished; 200 survives; 300 was already available and unticked
    expect(out.magics).toEqual([200]);
  });

  test("magics entering scope arrive selected", () => {
    const filters = { ...EMPTY_FILTERS, accounts: [111], magics: [100] };
    const out = reconcileFilters(scopeRows, filters, [111, 222]);
    // 300 is new to the scope → selected; 200 was available and unticked → stays out
    expect(out.magics).toEqual([100, 300]);
  });

  test("a selection covering every available magic collapses to null", () => {
    const filters = { ...EMPTY_FILTERS, magics: [100, 200] };
    expect(reconcileFilters(scopeRows, filters, [111]).magics).toBeNull();
  });

  test("a selection pruned to nothing collapses to null", () => {
    const filters = { ...EMPTY_FILTERS, magics: [100] };
    expect(reconcileFilters(scopeRows, filters, [222]).magics).toBeNull();
  });

  test("symbol resets when it leaves scope, survives when it doesn't", () => {
    const gone = { ...EMPTY_FILTERS, symbol: "XAUUSD" };
    expect(reconcileFilters(scopeRows, gone, [222]).symbol).toBeNull();
    const kept = { ...EMPTY_FILTERS, symbol: "EURUSD" };
    expect(reconcileFilters(scopeRows, kept, [222]).symbol).toBe("EURUSD");
  });
});
