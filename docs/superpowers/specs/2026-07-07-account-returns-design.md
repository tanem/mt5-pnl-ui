# Account returns — design

Date: 2026-07-07. Status: approved.

The dashboard currently answers "how did my trading do?" (net P&L,
win rate, profit factor over closed deals) but not "how did my money
do?". The snapshot already carries everything needed for the second
question — `cash_flows` (balance-family deals with timestamps and
amounts), per-account `balance` and `equity` — yet the UI only shows
cash flows as a raw table tab in Trades. This design adds an account
returns layer: total deposited, total withdrawn, floating P&L, profit,
and percentage gain, per account and per currency group.

This is the first figure family that deliberately does not mirror
mt5-pnl-cli — the CLI has no returns layer. Its semantics are defined
here, not deferred to the CLI's README.

## Goals

- Lifetime money-in / money-out figures per account: deposited,
  withdrawn, floating, profit, percentage gain.
- Profit derived from the account's authoritative state (balance,
  equity, cash flows), so it stays correct even when the snapshot's
  deal history is incomplete.
- A reconciliation check that surfaces incomplete deal history as an
  on-screen note instead of a silent discrepancy.

## Non-goals

- Time-weighted return (Myfxbook-style TWR). The headline is simple
  absolute gain; TWR needs balance-curve reconstruction and is a
  separate design if ever wanted.
- Balance-over-time chart and percentage-based drawdown. Same
  reconstruction; deliberately deferred.
- Streaks, day-of-week/hour-of-day breakdowns. Separate design.
- Any figure requiring data the snapshot lacks (trade duration,
  MAE/MFE, R-multiples need entry deals or stop levels, which the
  closing-deals-only snapshot does not carry).
- FX conversion or cross-currency totals. The mixed-currency guard
  stands: sums only within a currency group, never across.

## Semantics

All figures are per account, in the account currency, over the
account's lifetime as captured by the snapshot. They respect the
account filter only — never the date, symbol, or magic filters.

**Classification.** A cash-flow record whose `type` is MT5's balance
deal type is a **deposit** if its net amount is positive, a
**withdrawal** if negative. Net amount = `profit + swap + commission +
fee` (the same `dealNet` used everywhere; for balance deals the
non-profit components are zero). Every other balance-family type
(credit, charge, correction, bonus, …) is an **adjustment**.

**Core figures**, per account:

```
deposits    = Σ deposit amounts
withdrawals = Σ |withdrawal amounts|
floating    = equity − balance            (from AccountSnapshot)
profit      = withdrawals + balance + floating − deposits
            = withdrawals + equity − deposits
gainPct     = profit ÷ deposits           (null when deposits = 0)
adjustments = Σ net amounts of adjustment records
```

`profit` is identity-based: what came out plus what the account is
worth now, minus what went in. It does not sum closed deals, so a
truncated deal history cannot corrupt it. Adjustments are already
inside `profit` via `balance` — they are reported informationally and
never added or subtracted again. A broker bonus is gain the holder did
not deposit; a broker charge is a cost; both land in `profit`, and the
`deposits` denominator stays strictly "money put in".

**Reconciliation check**, per account:

```
deposits − withdrawals + adjustments + Σ dealNet(closed deals) ≈ balance
```

within a tolerance of 0.01 in the account currency. A failure means
the snapshot's deal history for that account is likely incomplete
(older than the exporter's history window). The UI shows a muted note;
no figure is hidden or altered — the identity-based `profit` is
correct either way.

**Aggregation.** Within a currency group: sums of deposits,
withdrawals, floating, and profit across the group's accounts; group
`gainPct = Σ profit ÷ Σ deposits`. Never across currency groups.

**Ratios.** `gainPct` is null when `deposits` is zero, rendered as
"n/a", matching how `PnlStats` handles zero denominators. Zero deposits
usually accompanies a failed reconciliation (the exporter window
missed the initial deposit); the note covers both.

**Staleness.** Figures are as-of each account's last successful
export, exactly like `balance` and `equity` today. No special
handling.

## UI

**Overview sections become account-driven.** Today the per-currency
sections are keyed off filtered deals, so a date filter can make a
whole section disappear. Sections are instead keyed off the currency
groups of the accounts in scope (account filter applied, nothing
else). Each section shows:

1. The trading stats and charts over that group's filtered deals, as
   today — with the existing "no deals match" message inside the
   section when the filters leave nothing.
2. The returns band, always populated.

Net effect: sections stay put when the date, symbol, or magic filters
narrow; only the trading half reacts.

**Returns band**, inside each currency section, directly after the
trading stat tiles and before the equity curve:

- Sub-heading in the same style as the currency heading:
  "Account returns — lifetime". When a date, symbol, or magic filter
  is active, a one-line caption: "Not affected by date, symbol, or
  magic filters."
- Tiles, reusing `StatTile` and its grid: Deposited (neutral),
  Withdrawn (neutral), Floating (pos/neg tone), Profit (pos/neg),
  Gain % (pos/neg). An Adjustments tile appears only when non-zero.
- Gain % uses a new signed-percent formatter in `src/lib/format.ts`
  (the existing `pct` formats 0–1 rates; gain is signed and can exceed
  100%).
- Per-account table, only when the group has more than one account:
  Account (label, falling back to login), Deposited, Withdrawn,
  Balance, Floating, Profit, Gain %. A plain table; no virtualisation.
- Reconciliation note: a marker on the failing account's row (or under
  the tiles for a single-account group) plus one muted caption line,
  e.g. "Trend EA: cash flows + trade P&L don't reconcile with the
  balance — snapshot deal history may be incomplete."
- Colours stay within the existing system: semantic POS/NEG through
  `StatTile`'s `tone` prop only; nothing new in `chartTheme.ts`.

## Architecture

**`src/lib/derive/returns.ts`** — new pure module in the style of
`stats.ts` and `equity.ts`:

- The MT5 balance deal-type constant lives here (no constants module
  exists; one value does not justify inventing one).
- `computeAccountReturns(account, flows, deals): AccountReturns` —
  `{ deposits, withdrawals, adjustments, balance, floating, profit,
  gainPct, reconciles }`, implementing the identity and the tolerance
  check above.
- `groupReturnsByCurrency(accounts, flows, deals, accountFilter)` —
  `Map<currency, { accounts: AccountReturns[], totals }>` with group
  `gainPct = Σ profit ÷ Σ deposits`.

**Selectors** (`src/store/selectors.ts`): a new `useReturnsGroups()`
applying only `filters.accounts` — honouring the convention that
`null` means all accounts and `[]` means none — and deliberately
bypassing `applyFilters`. The Overview keys its sections off these
account-derived currency groups; each section pulls its trading deals
from the existing filtered-deals grouping.

**Edge cases**:

- `deposits === 0` → `gainPct: null` → "n/a".
- `filters.accounts === []` → no sections; reuse the existing
  empty-state message.
- Negative floating, negative profit, gain below −100%: flow through
  signed formatting untouched.

## Testing

- **Unit** — `returns.test.ts`: classification (balance vs adjustment
  types, sign split), the profit identity, null gain, reconciliation
  pass/fail at the tolerance boundary, currency grouping, and the
  account-filter conventions (`null` vs `[]`). View tests: the band
  ignores a date filter while trading tiles react; the adjustments
  tile appears only when non-zero; the per-account table appears only
  for multi-account groups; the reconciliation note renders.
- **e2e** (`npm run e2e`, real build and worker) — extend the fixture
  (`scripts/build-e2e-fixture.mjs`): it already has one USD deposit;
  add a withdrawal and an EUR deposit, and set account
  `balance`/`equity` so the USD account reconciles (balance = deposits
  − withdrawals + Σ deal nets) and its gain % is a hand-checkable
  value asserted in `e2e/app.spec.ts`. Leave one account deliberately
  non-reconciling to assert the note. Assert the band stays populated
  under a date filter.
- **Visual inspection** (`npm run visual`) — capture the per-view
  screenshots to `visual-review/` and inspect the band's layout,
  spacing, and tones before calling the UI done.
- **Screenshot** (`npm run screenshot`) — regenerate
  `docs/screenshot.png` (Overview changes visibly) and commit it.

## Documentation

README and CLAUDE.md are updated in the same change: the returns
band's existence, and a gotcha stating that returns semantics are
defined by this repo (this spec), not mirrored from mt5-pnl-cli —
including the account-filter-only rule and the identity-based profit.
