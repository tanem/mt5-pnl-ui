/** Rows any snapshot record type can offer the filter. */
export interface Filterable {
  account: number;
  time: number;
  symbol: string;
  magic: number;
}

/**
 * null means "no filter" on that dimension; from/to are UTC dates,
 * inclusive. For accounts and magics, [] means "match nothing" — never
 * conflate it with null.
 */
export interface Filters {
  accounts: number[] | null;
  from: string | null; // "YYYY-MM-DD"
  to: string | null; // "YYYY-MM-DD"
  symbol: string | null;
  magics: number[] | null;
}

export const EMPTY_FILTERS: Filters = {
  accounts: null,
  from: null,
  to: null,
  symbol: null,
  magics: null,
};

export function applyFilters<T extends Filterable>(
  rows: T[],
  f: Filters,
): T[] {
  const fromSec = f.from ? Date.parse(`${f.from}T00:00:00Z`) / 1000 : null;
  const toSecExcl = f.to ? Date.parse(`${f.to}T00:00:00Z`) / 1000 + 86400 : null;
  const accounts = f.accounts ? new Set(f.accounts) : null;
  const symbol = f.symbol?.toUpperCase() ?? null;
  const magics = f.magics ? new Set(f.magics) : null;

  return rows.filter(
    (r) =>
      (accounts === null || accounts.has(r.account)) &&
      (fromSec === null || r.time >= fromSec) &&
      (toSecExcl === null || r.time < toSecExcl) &&
      (symbol === null || r.symbol.toUpperCase() === symbol) &&
      (magics === null || magics.has(r.magic)),
  );
}

/** Distinct magics on deals of the selected accounts (null = all), sorted. */
export function scopedMagics(
  deals: readonly Filterable[],
  accounts: readonly number[] | null,
): number[] {
  const scope = accounts === null ? null : new Set(accounts);
  const out = new Set<number>();
  for (const d of deals) if (scope === null || scope.has(d.account)) out.add(d.magic);
  return [...out].sort((a, b) => a - b);
}

/** Distinct symbols on deals of the selected accounts (null = all), sorted. */
export function scopedSymbols(
  deals: readonly Filterable[],
  accounts: readonly number[] | null,
): string[] {
  const scope = accounts === null ? null : new Set(accounts);
  const out = new Set<string>();
  for (const d of deals) if (scope === null || scope.has(d.account)) out.add(d.symbol);
  return [...out].sort();
}

/**
 * Reconcile the symbol and magic selections with a new account scope:
 * still-available selections survive, vanished ones are dropped, magics
 * entering scope arrive selected, and a selection covering everything —
 * or nothing — collapses back to null ("all"). See the 2026-07-09
 * dashboard-polish spec.
 */
export function reconcileFilters(
  deals: readonly Filterable[],
  filters: Filters,
  nextAccounts: number[] | null,
): Pick<Filters, "accounts" | "symbol" | "magics"> {
  let magics = filters.magics;
  if (magics !== null) {
    const available = scopedMagics(deals, nextAccounts);
    const previous = new Set(scopedMagics(deals, filters.accounts));
    const selected = new Set(magics);
    const next = available.filter((m) => selected.has(m) || !previous.has(m));
    magics = next.length === 0 || next.length === available.length ? null : next;
  }
  const symbol =
    filters.symbol !== null &&
    !scopedSymbols(deals, nextAccounts).includes(filters.symbol)
      ? null
      : filters.symbol;
  return { accounts: nextAccounts, symbol, magics };
}
