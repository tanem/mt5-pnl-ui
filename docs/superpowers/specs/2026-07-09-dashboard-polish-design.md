# Dashboard polish: screenshot fixture, returns table removal, scoped filter options

Date: 2026-07-09
Status: agreed

Three small, independent changes from a review of the rendered
dashboard and the README against a real multi-account snapshot: the
README screenshot leads with the fixture's worst data, the per-account
returns table clutters the Overview, and the magic filter offers every
magic in the snapshot regardless of which accounts are selected.

## 1. Dedicated screenshot fixture

**Problem.** `npm run screenshot` captures the Overview from the shared
e2e fixture. Currencies sort alphabetically, so the EUR section renders
first — and EUR is the fixture's deliberately degenerate account (one
trade, a non-reconciling balance) that exists to exercise the
mixed-currency guard and the incomplete-history note. The README leads
with a single-trade dashboard, an empty-looking chart, and a warning
footnote.

The e2e fixture's numbers are hand-tuned for exact test assertions;
making that fixture photogenic would force re-deriving every hand
computed expectation in the e2e suite.

**Change.** `scripts/build-e2e-fixture.mjs` writes a second output,
`e2e/fixtures/screenshot.json.gz.age`, alongside the existing fixture.
Same passphrase (`e2e-passphrase`), same schema, same CI build step —
the script simply writes both files.

The screenshot snapshot's data is generated with a small seeded PRNG
(an inline mulberry32; no new dependency) so regeneration is
byte-deterministic:

- One currency (USD) and two accounts, both reconciling — no
  multi-currency banner, no incomplete-history footnote.
- Roughly 15 months of closed deals ending near the snapshot's
  `generated_at`, a few hundred deals across 4–5 symbols and 3–4
  magics.
- Win rate around 55% with an upward-drifting cumulative curve that
  includes visible pullbacks; mostly-green monthly bars with some red;
  activity within the last 30 days so the daily chart is populated.
- Deposits plus at least one withdrawal, so the returns band shows a
  plausible lifetime gain.

Exact deal counts, seeds, and amounts are implementation detail — the
acceptance bar is the rendered Overview, not specific figures.

`e2e/fixture.ts`'s `dropFixture` takes an optional fixture filename.
`screenshot.spec.ts` and `visual.spec.ts` (both human-facing captures)
switch to the screenshot fixture; `app.spec.ts` and the e2e assertions
stay on the existing fixture, untouched.

`docs/screenshot.png` is regenerated and committed as part of the
change.

## 2. Remove the per-account returns table

**Problem.** `ReturnsBand` renders a per-account table (account,
deposited, withdrawn, balance, floating, profit, gain) whenever a
currency group holds more than one account. With several accounts it
dominates the Overview and duplicates what the totals tiles already
summarise.

**Change.** Delete the table and the `*` marker convention from
`ReturnsBand.tsx`. What remains:

- the group totals tiles (Deposited / Withdrawn / Transferred when
  non-zero / Floating / Profit / Gain / Adjustments when non-zero),
- the incomplete-history footnote, rendered as a plain sentence (no
  leading `*`) whenever at least one account in the group fails to
  reconcile.

The data layer is unchanged: `returns.ts` still computes per-account
figures, because the group totals and the reconciliation check derive
from them.

This supersedes the "Shared reconciliation footnote" presentation in
the 2026-07-08 dashboard-refinements spec insofar as it referenced the
table; the single-footnote behaviour itself is retained.

## 3. Account-scoped filter options

**Problem.** `FilterBar` derives the magic checkbox list and the symbol
dropdown from every closed deal in the snapshot. With one account
deselected, magics that exist only in that account still show as
options — a real snapshot can surface dozens of irrelevant magics.

**Change.** Both option lists derive from deals of the selected
accounts only (`filters.accounts ?? all`). Scoping is by account only:
date, symbol, and magic filters do not feed back into the option lists,
which keeps the derivation acyclic.

Selection state is reconciled by a pure helper in
`src/lib/derive/filters.ts`, applied when the account filter changes:

- `magics === null` stays `null`.
- Otherwise the next selection is
  `(selected ∩ newly available) ∪ (newly available − previously
  available)` — still-valid choices survive, vanished ones are dropped,
  and magics entering scope arrive selected (reselecting an account
  shows its deals rather than hiding them behind a stale whitelist).
- If the result covers every available magic, or none, it collapses to
  `null`.
- `symbol` resets to `null` when the selected symbol is no longer
  available.

The existing semantics are preserved exactly: `null` means "all", `[]`
means "match nothing", and ticking every visible checkbox collapses to
`null` against the scoped list. `applyFilters` is unchanged.

**Edge cases.**

- Deselecting the only account that uses an unticked magic, then
  reselecting it: if that magic was the only exclusion, the filter
  collapsed to `null` in between, so it returns ticked. If other
  exclusions kept the filter a list, it returns ticked via the
  newly-available rule.
- Deselecting accounts until a previously ticked-only magic vanishes:
  the selection prunes to empty and collapses to `null` — the remaining
  accounts show all their deals instead of none.

## Testing

- Unit: the reconciliation helper's edges (null passthrough, prune,
  newly-available auto-select, collapse to `null` on full or empty);
  `FilterBar` shows only scoped options and updates them on account
  toggles; `ReturnsBand` renders no table for multi-account groups and
  keeps the footnote.
- e2e: existing assertions updated where they referenced the
  per-account table; an assertion that toggling an account changes the
  visible magic options (in the shared fixture, magic 200 exists only
  in the first USD account, so deselecting it removes an option).
- The screenshot fixture is exercised by `npm run screenshot` /
  `npm run visual`, which are inspection aids, not tests; the
  acceptance check is eyeballing the regenerated
  `docs/screenshot.png`.

## Non-goals

- No expectancy tile, day-of-week or hour-of-day breakdowns — parked
  as future work.
- No relocation of the per-account breakdown to another view; it is
  removed, not moved.
- No date- or symbol-driven narrowing of filter options; scoping is by
  account only.
