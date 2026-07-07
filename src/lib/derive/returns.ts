import type { AccountSnapshot, CashFlow, ClosedDeal } from "../snapshot/types";
import { dealNet } from "./stats";

/** MT5's balance deal type — deposits and withdrawals, sign-distinguished. */
export const BALANCE_DEAL_TYPE = 2;

/** Reconciliation tolerance, in account currency (float rounding headroom). */
const RECONCILE_TOLERANCE = 0.01;

/**
 * Lifetime money-in/out figures for one account. Semantics are this repo's
 * own (the account returns spec), not mirrored from mt5-pnl-cli. Profit is
 * identity-based — withdrawals + balance + floating − deposits — so a
 * truncated deal history cannot corrupt it. Adjustments (credits, charges,
 * corrections, bonuses, …) already sit inside `balance`, and therefore
 * inside `profit`; they are reported informationally, never re-added.
 */
export interface AccountReturns {
  login: number;
  label: string;
  currency: string;
  deposits: number;
  withdrawals: number;
  adjustments: number;
  balance: number;
  floating: number;
  profit: number;
  /** profit ÷ deposits; null when nothing was deposited. */
  gainPct: number | null;
  /** deposits − withdrawals + adjustments + Σ dealNet ≈ balance. */
  reconciles: boolean;
}

export interface ReturnsTotals {
  deposits: number;
  withdrawals: number;
  adjustments: number;
  floating: number;
  profit: number;
  gainPct: number | null;
}

export interface ReturnsGroup {
  accounts: AccountReturns[];
  totals: ReturnsTotals;
}

export function computeAccountReturns(
  account: AccountSnapshot,
  flows: CashFlow[],
  deals: ClosedDeal[],
): AccountReturns {
  let deposits = 0;
  let withdrawals = 0;
  let adjustments = 0;
  for (const f of flows) {
    if (f.account !== account.login) continue;
    const net = dealNet(f);
    if (f.type !== BALANCE_DEAL_TYPE) adjustments += net;
    else if (net > 0) deposits += net;
    else withdrawals += -net;
  }

  let dealsNet = 0;
  for (const d of deals) {
    if (d.account === account.login) dealsNet += dealNet(d);
  }

  const floating = account.equity - account.balance;
  const profit = withdrawals + account.balance + floating - deposits;
  return {
    login: account.login,
    label: account.label,
    currency: account.currency,
    deposits,
    withdrawals,
    adjustments,
    balance: account.balance,
    floating,
    profit,
    gainPct: deposits > 0 ? profit / deposits : null,
    // The 1e-9 epsilon absorbs float representation noise without moving
    // the real boundary.
    reconciles:
      Math.abs(deposits - withdrawals + adjustments + dealsNet - account.balance) <=
      RECONCILE_TOLERANCE + 1e-9,
  };
}

/**
 * Returns per account currency, for the accounts in scope. Aggregates only
 * within a group — never across currencies (the mixed-currency guard).
 */
export function groupReturnsByCurrency(
  accounts: AccountSnapshot[],
  flows: CashFlow[],
  deals: ClosedDeal[],
  accountFilter: number[] | null,
): Map<string, ReturnsGroup> {
  const scope =
    accountFilter === null
      ? accounts
      : accounts.filter((a) => accountFilter.includes(a.login));

  const out = new Map<string, ReturnsGroup>();
  for (const a of scope) {
    const r = computeAccountReturns(a, flows, deals);
    let group = out.get(a.currency);
    if (!group) {
      group = {
        accounts: [],
        totals: {
          deposits: 0,
          withdrawals: 0,
          adjustments: 0,
          floating: 0,
          profit: 0,
          gainPct: null,
        },
      };
      out.set(a.currency, group);
    }
    group.accounts.push(r);
    group.totals.deposits += r.deposits;
    group.totals.withdrawals += r.withdrawals;
    group.totals.adjustments += r.adjustments;
    group.totals.floating += r.floating;
    group.totals.profit += r.profit;
  }
  for (const group of out.values()) {
    group.totals.gainPct =
      group.totals.deposits > 0 ? group.totals.profit / group.totals.deposits : null;
  }
  return out;
}
