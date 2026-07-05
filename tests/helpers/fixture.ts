import { gzipSync } from "node:zlib";
import { Encrypter } from "age-encryption";
import type {
  AccountSnapshot,
  ClosedDeal,
  Snapshot,
} from "../../src/lib/snapshot/types";

export function deal(overrides: Partial<ClosedDeal> = {}): ClosedDeal {
  return {
    account: 1234567,
    ticket: 1,
    order: 1,
    position_id: 1,
    time: 1750000000, // 2025-06-15T15:06:40Z
    time_msc: 1750000000000,
    type: 1,
    entry: 1,
    reason: 3,
    magic: 100,
    volume: 0.1,
    price: 1.1,
    profit: 10,
    swap: 0,
    commission: -0.5,
    fee: 0,
    symbol: "EURUSD",
    comment: "",
    external_id: "",
    ...overrides,
  };
}

export function account(
  overrides: Partial<AccountSnapshot> = {},
): AccountSnapshot {
  return {
    login: 1234567,
    label: "Trend EA",
    currency: "USD",
    balance: 10000,
    equity: 10000,
    last_success_at: "2026-07-05T00:00:00Z",
    last_error: null,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    schema_version: "1.0",
    generated_at: "2026-07-05T00:00:00Z",
    accounts: [account()],
    closed_deals: [deal()],
    open_positions: [],
    cash_flows: [],
    ...overrides,
  };
}

/** JSON → gzip → age, the exporter's write pipeline in miniature. */
export async function encryptSnapshot(
  snap: Snapshot,
  passphrase: string,
): Promise<Uint8Array> {
  const gz = gzipSync(JSON.stringify(snap));
  const enc = new Encrypter();
  enc.setPassphrase(passphrase);
  enc.setScryptWorkFactor(10); // fast for tests; default 18 is ~1s per call
  return enc.encrypt(new Uint8Array(gz));
}
