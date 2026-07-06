import type { ClosedDeal } from "../snapshot/types";
import { dealNet } from "./stats";

/** UTC day of a Unix-seconds timestamp, "YYYY-MM-DD". */
export function dayKeyUTC(timeSec: number): string {
  return new Date(timeSec * 1000).toISOString().slice(0, 10);
}

/** UTC month of a Unix-seconds timestamp, "YYYY-MM". */
export function monthKeyUTC(timeSec: number): string {
  return new Date(timeSec * 1000).toISOString().slice(0, 7);
}

export interface Bucket {
  net: number;
  trades: number;
}

function bucketBy(
  deals: ClosedDeal[],
  key: (timeSec: number) => string,
): Map<string, Bucket> {
  const out = new Map<string, Bucket>();
  for (const d of deals) {
    const k = key(d.time);
    const b = out.get(k) ?? { net: 0, trades: 0 };
    b.net += dealNet(d);
    b.trades += 1;
    out.set(k, b);
  }
  return out;
}

export function bucketByDayUTC(deals: ClosedDeal[]): Map<string, Bucket> {
  return bucketBy(deals, dayKeyUTC);
}

export function bucketByMonthUTC(deals: ClosedDeal[]): Map<string, Bucket> {
  return bucketBy(deals, monthKeyUTC);
}
