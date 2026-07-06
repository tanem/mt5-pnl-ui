import { describe, expect, test } from "vitest";
import { applyFilters, EMPTY_FILTERS } from "./filters";
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

  test("magic is exact", () => {
    const out = applyFilters(rows, { ...EMPTY_FILTERS, magic: 200 });
    expect(out.map((r) => r.magic)).toEqual([200]);
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
      magic: 100,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.time).toBe(T_JUN1);
  });
});
