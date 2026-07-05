export interface AccountSnapshot {
  login: number;
  label: string;
  currency: string;
  balance: number;
  equity: number;
  last_success_at: string | null;
  last_error: string | null;
}

/** One closing trade deal — every field MT5 emits, plus `account`. */
export interface ClosedDeal {
  account: number;
  ticket: number;
  order: number;
  position_id: number;
  time: number; // Unix seconds, MT5's recorded value; bucketing is UTC on this
  time_msc: number;
  type: number;
  entry: number;
  reason: number;
  magic: number;
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  fee: number;
  symbol: string;
  comment: string;
  external_id: string;
}

/** Balance-family deal (deposit/withdrawal/…) — same shape as ClosedDeal. */
export type CashFlow = ClosedDeal;

export interface OpenPosition {
  account: number;
  ticket: number;
  identifier: number;
  time: number;
  time_msc: number;
  time_update: number;
  time_update_msc: number;
  type: number;
  reason: number;
  magic: number;
  volume: number;
  price_open: number;
  price_current: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  symbol: string;
  comment: string;
  external_id: string;
}

export interface Snapshot {
  schema_version: string;
  generated_at: string;
  accounts: AccountSnapshot[];
  closed_deals: ClosedDeal[];
  open_positions: OpenPosition[];
  cash_flows: CashFlow[];
}
