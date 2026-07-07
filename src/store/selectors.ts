import { useMemo } from "react";
import { useApp } from "./app";
import { applyFilters } from "../lib/derive/filters";
import { splitByCurrency } from "../lib/derive/currency";
import { groupReturnsByCurrency } from "../lib/derive/returns";
import type { ReturnsGroup } from "../lib/derive/returns";
import type { AccountSnapshot, ClosedDeal } from "../lib/snapshot/types";

export function useAccounts(): AccountSnapshot[] {
  return useApp((s) => s.snapshot?.accounts ?? []);
}

/** Closed deals with the global filter applied. */
export function useFilteredDeals(): ClosedDeal[] {
  const deals = useApp((s) => s.snapshot?.closed_deals);
  const filters = useApp((s) => s.filters);
  return useMemo(() => applyFilters(deals ?? [], filters), [deals, filters]);
}

/**
 * Filtered deals grouped per account currency. Views render one section per
 * group and never sum across groups (the mixed-currency guard).
 */
export function useCurrencyGroups(): Map<string, ClosedDeal[]> {
  const deals = useFilteredDeals();
  const accounts = useAccounts();
  return useMemo(() => splitByCurrency(deals, accounts), [deals, accounts]);
}

/**
 * Lifetime returns per account currency. Applies only the account filter —
 * never date/symbol/magic. Semantics are this repo's own (the account
 * returns spec), not mirrored from mt5-pnl-cli.
 */
export function useReturnsGroups(): Map<string, ReturnsGroup> {
  const snapshot = useApp((s) => s.snapshot);
  const accounts = useApp((s) => s.filters.accounts);
  return useMemo(
    () =>
      groupReturnsByCurrency(
        snapshot?.accounts ?? [],
        snapshot?.cash_flows ?? [],
        snapshot?.closed_deals ?? [],
        accounts,
      ),
    [snapshot, accounts],
  );
}
