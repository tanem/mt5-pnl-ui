import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { Encrypter } from "age-encryption";

const deal = (o) => ({
  account: 1234567, ticket: 1, order: 1, position_id: 1,
  time: 0, time_msc: 0, type: 1, entry: 1, reason: 3, magic: 100,
  volume: 0.1, price: 1.1, profit: 0, swap: 0, commission: -0.5, fee: 0,
  symbol: "EURUSD", comment: "", external_id: "", ...o,
});

// Balance-family record: trade fields zeroed, amount in `profit`.
const flow = (o) => deal({ type: 2, entry: 0, magic: 0, volume: 0, price: 0, profit: 0, commission: 0, symbol: "", ...o });

const DAY = 86400;
const start = Date.UTC(2026, 4, 1, 12) / 1000; // 2026-05-01T12:00Z
const profits = [12, -6, 8, -3, 15, -9, 4, 7, -2, 10, -5, 20];

const closed_deals = profits.map((p, i) =>
  deal({
    ticket: i + 1,
    time: start + i * 5 * DAY, // spans May and June 2026
    time_msc: (start + i * 5 * DAY) * 1000,
    profit: p,
    symbol: i % 3 === 2 ? "XAUUSD" : "EURUSD",
    magic: i % 2 === 0 ? 100 : 200,
  }),
);
// one EUR-account deal to exercise the mixed-currency guard
closed_deals.push(
  deal({ account: 7654321, ticket: 99, time: start + 3 * DAY, time_msc: (start + 3 * DAY) * 1000, profit: 5 }),
);

const snapshot = {
  schema_version: "1.0",
  generated_at: "2026-07-01T00:00:00Z",
  accounts: [
    // USD reconciles: 10,000 − 2,000 + 45 (Σ closed-deal nets: 51 profit − 6
    // commission) = 8,045; equity 8,200 → floating +155, gain +2.0%.
    { login: 1234567, label: "Trend EA", currency: "USD", balance: 8045, equity: 8200, last_success_at: "2026-07-01T00:00:00Z", last_error: null },
    // EUR deliberately does not reconcile: 4,000 + 4.5 ≠ 5,000 — exercises
    // the incomplete-history note; profit 1,000, gain +25.0%.
    { login: 7654321, label: "Scalper EA", currency: "EUR", balance: 5000, equity: 5000, last_success_at: "2026-07-01T00:00:00Z", last_error: null },
  ],
  closed_deals,
  open_positions: [],
  cash_flows: [
    flow({ account: 1234567, ticket: 1000, profit: 10000, comment: "Deposit", time: start - 30 * DAY, time_msc: (start - 30 * DAY) * 1000 }),
    flow({ account: 1234567, ticket: 1001, profit: -2000, comment: "Withdrawal", time: start + 40 * DAY, time_msc: (start + 40 * DAY) * 1000 }),
    flow({ account: 7654321, ticket: 1002, profit: 4000, comment: "Deposit", time: start - 30 * DAY, time_msc: (start - 30 * DAY) * 1000 }),
  ],
};

const enc = new Encrypter();
enc.setPassphrase("e2e-passphrase");
const bytes = await enc.encrypt(new Uint8Array(gzipSync(JSON.stringify(snapshot))));
mkdirSync("e2e/fixtures", { recursive: true });
writeFileSync("e2e/fixtures/snapshot.json.gz.age", bytes);
console.log("wrote e2e/fixtures/snapshot.json.gz.age");
