import { useMemo } from "react";
import { useApp } from "./app";
import { applyFilters } from "../lib/derive/filters";
import { splitByCurrency } from "../lib/derive/currency";
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
