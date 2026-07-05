import type { ClosedDeal } from "../snapshot/types";
import { dealNet } from "./stats";

export interface EquityPoint {
  timeMsc: number;
  cum: number;
}

/** Cumulative realised net P&L over deals ordered by time (ticket tiebreak). */
export function equityCurve(deals: ClosedDeal[]): EquityPoint[] {
  const sorted = [...deals].sort(
    (a, b) => a.time_msc - b.time_msc || a.ticket - b.ticket,
  );
  let cum = 0;
  return sorted.map((d) => {
    cum += dealNet(d);
    return { timeMsc: d.time_msc, cum };
  });
}

/**
 * Largest peak-to-trough fall of the curve, accumulated from zero,
 * signed negative; 0 when the curve never falls. This is realised-P&L
 * drawdown, not account-equity drawdown (matches mt5-pnl-cli).
 */
export function maxDrawdown(curve: EquityPoint[]): number {
  let peak = 0;
  let dd = 0;
  for (const p of curve) {
    if (p.cum > peak) peak = p.cum;
    if (p.cum - peak < dd) dd = p.cum - peak;
  }
  return dd;
}
