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
    // USD, Trend EA: 10,000 − 2,000 − 500 (transfer out) + 45 (Σ closed-deal
    // nets: 51 profit − 6 commission) = 7,545; equity 7,700 → floating +155.
    // Per-account profit 2,500 + 7,545 + 155 − 10,000 = +200.
    { login: 1234567, label: "Trend EA", currency: "USD", balance: 7545, equity: 7700, last_success_at: "2026-07-01T00:00:00Z", last_error: null },
    // USD, Grid EA: seeded only by the 500 transfer in; balance 500 →
    // reconciles, per-account profit 0. Group totals: deposited 10,000 and
    // withdrawn 2,000 stay external-only, transferred 500, profit +200,
    // gain +2.0%.
    { login: 2345678, label: "Grid EA", currency: "USD", balance: 500, equity: 500, last_success_at: "2026-07-01T00:00:00Z", last_error: null },
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
    flow({ account: 1234567, ticket: 1003, profit: -500, comment: "Transfer to 2345678", time: start + 20 * DAY, time_msc: (start + 20 * DAY) * 1000 }),
    flow({ account: 2345678, ticket: 1004, profit: 500, comment: "Transfer from 1234567", time: start + 20 * DAY + 30, time_msc: (start + 20 * DAY + 30) * 1000 }),
  ],
};

// ---------------------------------------------------------------------------
// Screenshot fixture: deterministic synthetic data that renders like a real
// trading history, for the README screenshot and visual review
// (npm run screenshot / npm run visual). Never used by e2e assertions, so
// the exact figures are free to change — it only has to look plausible.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260709);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const dealNet = (d) => d.profit + d.commission + d.swap + d.fee;

const SS_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "US500"];
const SS_START = Date.UTC(2025, 3, 6, 8) / 1000; // 2025-04-06 — ~15 months
const SS_END = Date.UTC(2026, 5, 30, 19) / 1000; // 2026-06-30

/** Deals spread evenly over the window with jitter; ~winRate winners. */
function makeDeals({ account, magics, count, winRate, avgWin, avgLoss, firstTicket }) {
  const deals = [];
  for (let i = 0; i < count; i++) {
    const time = Math.round(
      SS_START + ((SS_END - SS_START) * i) / (count - 1) + (rand() - 0.5) * 36000,
    );
    const win = rand() < winRate;
    const scale = 0.3 + 1.4 * rand();
    deals.push(
      deal({
        account,
        ticket: firstTicket + i,
        order: firstTicket + i,
        position_id: firstTicket + i,
        time,
        time_msc: time * 1000,
        profit: round2(win ? avgWin * scale : -avgLoss * scale),
        commission: -0.7,
        swap: rand() < 0.25 ? round2(-1.5 * rand()) : 0,
        volume: round2(0.1 + 0.9 * rand()),
        symbol: pick(SS_SYMBOLS),
        magic: pick(magics),
      }),
    );
  }
  return deals;
}

const trendDeals = makeDeals({
  account: 5001001, magics: [30125, 30126, 30127],
  count: 300, winRate: 0.56, avgWin: 85, avgLoss: 60, firstTicket: 10000,
});
const swingDeals = makeDeals({
  account: 5001002, magics: [41200],
  count: 140, winRate: 0.52, avgWin: 140, avgLoss: 95, firstTicket: 50000,
});

const ssFlows = [
  flow({ account: 5001001, ticket: 9000, profit: 5000, comment: "Deposit", time: SS_START - 10 * DAY, time_msc: (SS_START - 10 * DAY) * 1000 }),
  flow({ account: 5001001, ticket: 9001, profit: -1500, comment: "Withdrawal", time: Date.UTC(2026, 0, 15) / 1000, time_msc: Date.UTC(2026, 0, 15) }),
  flow({ account: 5001002, ticket: 9002, profit: 4000, comment: "Deposit", time: SS_START - 5 * DAY, time_msc: (SS_START - 5 * DAY) * 1000 }),
  flow({ account: 5001002, ticket: 9003, profit: 1000, comment: "Deposit", time: Date.UTC(2025, 10, 3) / 1000, time_msc: Date.UTC(2025, 10, 3) }),
];

/** Balance = flows + deal nets, so both accounts reconcile exactly. */
function balanceOf(login) {
  const rows = [...ssFlows, ...trendDeals, ...swingDeals].filter((r) => r.account === login);
  return round2(rows.reduce((s, r) => s + dealNet(r), 0));
}

const screenshotSnapshot = {
  schema_version: "1.0",
  generated_at: "2026-07-01T00:00:00Z",
  accounts: [
    { login: 5001001, label: "Trend EA", currency: "USD", balance: balanceOf(5001001), equity: balanceOf(5001001), last_success_at: "2026-07-01T00:00:00Z", last_error: null },
    { login: 5001002, label: "Swing EA", currency: "USD", balance: balanceOf(5001002), equity: balanceOf(5001002), last_success_at: "2026-07-01T00:00:00Z", last_error: null },
  ],
  closed_deals: [...trendDeals, ...swingDeals],
  open_positions: [],
  cash_flows: ssFlows,
};

async function writeFixture(file, snap) {
  const enc = new Encrypter();
  enc.setPassphrase("e2e-passphrase");
  const bytes = await enc.encrypt(new Uint8Array(gzipSync(JSON.stringify(snap))));
  writeFileSync(`e2e/fixtures/${file}`, bytes);
  console.log(`wrote e2e/fixtures/${file}`);
}

mkdirSync("e2e/fixtures", { recursive: true });
await writeFixture("snapshot.json.gz.age", snapshot);
await writeFixture("screenshot.json.gz.age", screenshotSnapshot);
