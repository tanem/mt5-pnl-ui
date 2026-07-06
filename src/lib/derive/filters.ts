/** Rows any snapshot record type can offer the filter. */
export interface Filterable {
  account: number;
  time: number;
  symbol: string;
  magic: number;
}

/** null means "no filter" on that dimension; from/to are UTC dates, inclusive. */
export interface Filters {
  accounts: number[] | null;
  from: string | null; // "YYYY-MM-DD"
  to: string | null; // "YYYY-MM-DD"
  symbol: string | null;
  magic: number | null;
}

export const EMPTY_FILTERS: Filters = {
  accounts: null,
  from: null,
  to: null,
  symbol: null,
  magic: null,
};

export function applyFilters<T extends Filterable>(
  rows: T[],
  f: Filters,
): T[] {
  const fromSec = f.from ? Date.parse(`${f.from}T00:00:00Z`) / 1000 : null;
  const toSecExcl = f.to ? Date.parse(`${f.to}T00:00:00Z`) / 1000 + 86400 : null;
  const accounts = f.accounts ? new Set(f.accounts) : null;
  const symbol = f.symbol?.toUpperCase() ?? null;

  return rows.filter(
    (r) =>
      (accounts === null || accounts.has(r.account)) &&
      (fromSec === null || r.time >= fromSec) &&
      (toSecExcl === null || r.time < toSecExcl) &&
      (symbol === null || r.symbol.toUpperCase() === symbol) &&
      (f.magic === null || r.magic === f.magic),
  );
}
