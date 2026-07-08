# Dashboard refinements: reconciliation footnote, multi-magic filter, transfer-aware returns

Date: 2026-07-08
Status: agreed

Three small, independent refinements to the dashboard. Each was scoped
from a review of the rendered views against a real multi-account
snapshot. A fourth observation from the same review — the Costs tile
reading 0.00 — turned out to be an exporter-side gap and is deferred
(see Non-goals).

Visual treatment for all three follows the existing component language
(`StatTile`, the `FilterBar` fieldset pattern, the returns table), with
presentation patterns cross-checked against established trading-journal
apps (e.g. TradeZella, Edgewonk) where an equivalent feature exists.
When a borrowed pattern and simplicity conflict, simplicity wins.

## 1. Shared reconciliation footnote

**Problem.** `ReturnsBand` renders one full-sentence footnote per
account that fails the reconciliation check. With several failing
accounts the band ends in a stack of near-identical sentences.

**Change.** Keep the `*` marker beside failing account names in the
per-account table. Replace the per-account paragraphs with a single
footnote, rendered once when at least one account in the currency group
fails:

> \* Cash flows + trade P&L don't reconcile with the balance — snapshot
> deal history may be incomplete.

**Edge case.** A single-account group renders no table (the
`accounts.length > 1` guard), so no `*` exists to reference. Render the
same sentence without the leading `*`; with one account there is no
ambiguity about which account it describes.

The data layer (`AccountReturns.reconciles`) is unchanged.

## 2. Multi-select magic filter

**Problem.** The magic filter is a bare `<input type="number">` holding
a single value. There is no way to select several magics, and nothing
shows which magics exist in the data.

**Change.** Replace `Filters.magic: number | null` with
`magics: number[] | null`, adopting the accounts-filter semantics
exactly:

- `null` — no filter (all magics),
- `[]` — match nothing,
- toggling every checkbox on resets to `null`.

`applyFilters` matches with
`f.magics === null || f.magics.includes(r.magic)`.

`FilterBar` replaces the number input with a checkbox fieldset in the
same style as the Accounts row: one checkbox per distinct magic found in
the snapshot's closed deals, sorted ascending, computed from the
unfiltered deal list (as the symbol dropdown already does). With many
magics the row wraps; that is acceptable for the expected handful.

The returns band's "Not affected by date, symbol, or magic filters"
caption already covers the renamed filter; only the store's filter shape,
`applyFilters`, and `FilterBar` change.

## 3. Transfer-aware group returns

**Problem.** MT5 records an inter-account transfer as a negative
balance deal on the source account and a positive one on the
destination. `computeAccountReturns` classifies balance deals purely by
sign, so a transfer inflates both group Deposited and group Withdrawn,
and understates group Gain % (its denominator includes money that was
merely moved between in-scope accounts, not new capital). Group Profit
is unaffected — the two legs cancel in the identity.

**Semantics.**

- **Group totals** count only external flows: Deposited and Withdrawn
  sum the unpaired legs; a new `transfers` total sums the paired
  amounts; Gain % = profit ÷ external deposits, `null` when external
  deposits are zero.
- **Per-account rows are unchanged**, including `reconciles`. From a
  single account's perspective a transfer out is a withdrawal, and an
  account seeded entirely by transfer keeps a meaningful deposit base
  for its own gain figure.
- **Pairing respects the account filter.** A transfer to an account
  outside the current selection is money leaving the visible group and
  stays classified as an external withdrawal.

**Detection.** A new pure function in `src/lib/derive/returns.ts`,
`pairInternalTransfers`, pairs balance-type flows
(`type === BALANCE_DEAL_TYPE`) into transfer legs. Two flows pair when
all of the following hold:

- one has negative net and the other positive net (net =
  `dealNet(flow)`),
- they sit on two different in-scope accounts whose account currencies
  are equal,
- their magnitudes are equal within 0.01 (the existing
  `RECONCILE_TOLERANCE`),
- their `time_msc` values are within a 2-minute window (120 000 ms).

Each flow participates in at most one pair. Candidate pairs are resolved
deterministically: nearest in time first, ties broken by ticket order.

**UI.** `ReturnsBand` gains a "Transferred" `StatTile` (neutral tone)
after Withdrawn, rendered only when the group's transfer total is
non-zero — the same conditional pattern as the existing Adjustments
tile. A seventh tile wraps on the current `lg:grid-cols-6` grid; that is
acceptable.

## Testing

- Unit tests for `pairInternalTransfers`: a matching pair; a miss on
  each criterion (time window, amount tolerance, same account,
  different currencies, counterparty filtered out); a leg that could
  match two counterparts pairs with exactly one, nearest in time.
- Group-totals tests: external deposits/withdrawals exclude paired
  legs; `transfers` sums them; Gain % uses external deposits and is
  `null` when all funding was internal.
- `ReturnsBand` tests: one shared footnote for multiple failing
  accounts; footnote without `*` for a failing single-account group;
  Transferred tile only when non-zero.
- `FilterBar` tests: checkbox per distinct magic; all-on resets to
  `null`; partial selection filters deals in every view (via
  `applyFilters` tests).
- e2e: extend the synthetic fixture with one transfer pair between two
  same-currency accounts and assert the Transferred tile and the
  adjusted group totals reconcile with the fixture's hand-checkable
  numbers.
- Refresh `docs/screenshot.png` (`npm run screenshot`) — the FilterBar
  visibly changes.

## Non-goals

- **Deal-level costs.** The Costs tile reads 0.00 for snapshots whose
  brokers book commission on the entry deal: mt5-pnl-exporter keeps only
  `DEAL_ENTRY_OUT`/`INOUT`/`OUT_BY` deals, so entry-side commission
  never reaches the snapshot (and likely explains blanket reconciliation
  failures). The fix is upstream — export entry-deal costs, bump the
  schema, then flow through the CLI and this UI — and gets its own
  design in mt5-pnl-exporter.
- **Cross-currency transfer pairing.** Legs with different account
  currencies cannot be paired on amount; they remain classified as
  external.
- **Excluding transfers from per-account rows.**
- **Combined cross-currency totals** (the mixed-currency guard stands).

## Affected files

- `src/lib/derive/filters.ts` — `magic` → `magics`, match logic.
- `src/lib/derive/returns.ts` — `pairInternalTransfers`, group totals,
  `transfers` field on `ReturnsTotals`.
- `src/store/app.ts` / `src/store/selectors.ts` — filter shape,
  returns selector plumbing.
- `src/components/FilterBar.tsx` — magic checkboxes.
- `src/components/ReturnsBand.tsx` — shared footnote, Transferred tile.
- Tests alongside each, the e2e fixture and suite, `docs/screenshot.png`,
  CLAUDE.md and README where they describe the filter shape and the
  returns band fields.
