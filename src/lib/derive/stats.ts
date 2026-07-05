import type { ClosedDeal } from "../snapshot/types";

/** Net P&L of one deal: profit + swap + commission + fee, MT5's native signs. */
export function dealNet(d: ClosedDeal): number {
  return d.profit + d.swap + d.commission + d.fee;
}

/**
 * Summary statistics over a selection of closed deals.
 * Semantics mirror mt5-pnl-cli: win = net > 0, loss = net < 0, breakeven
 * counts toward trades but neither bucket; winRate = wins / trades;
 * profitFactor = grossProfit / |grossLoss|; avgLoss is signed negative.
 * Ratios are null when their denominator is zero.
 */
export interface PnlStats {
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  netPnl: number;
  tradeProfit: number;
  commission: number;
  swap: number;
  fee: number;
  /** commission + swap + fee (broker costs), signed. */
  costs: number;
  winRate: number | null;
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
}

export function computeStats(deals: ClosedDeal[]): PnlStats {
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let tradeProfit = 0;
  let commission = 0;
  let swap = 0;
  let fee = 0;

  for (const d of deals) {
    const net = dealNet(d);
    if (net > 0) {
      wins++;
      grossProfit += net;
    } else if (net < 0) {
      losses++;
      grossLoss += net;
    }
    tradeProfit += d.profit;
    commission += d.commission;
    swap += d.swap;
    fee += d.fee;
  }

  const trades = deals.length;
  return {
    trades,
    wins,
    losses,
    breakevens: trades - wins - losses,
    netPnl: tradeProfit + commission + swap + fee,
    tradeProfit,
    commission,
    swap,
    fee,
    costs: commission + swap + fee,
    winRate: trades > 0 ? wins / trades : null,
    profitFactor: grossLoss !== 0 ? grossProfit / Math.abs(grossLoss) : null,
    avgWin: wins > 0 ? grossProfit / wins : null,
    avgLoss: losses > 0 ? grossLoss / losses : null,
  };
}
