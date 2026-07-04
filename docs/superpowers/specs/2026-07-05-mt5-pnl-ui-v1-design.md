# mt5-pnl-ui — v1 design

Date: 2026-07-05. Status: approved.

`mt5-pnl-ui` is the third repo in the mt5-pnl family. The exporter
(`mt5-pnl-exporter`) writes one encrypted snapshot
(`snapshot.json.gz.age`) of MT5 deal history; the CLI (`mt5-pnl-cli`)
reads it in the terminal. This repo adds a browser reader: a dashboard
for the same snapshot, with charts, a P&L calendar, a trades table, and
per-strategy comparison.

The snapshot is the contract. The UI adds no data of its own — it
filters, aggregates, and renders what the exporter already emits
(schema `1.0`: `accounts`, `closed_deals`, `open_positions`,
`cash_flows`; raw records, no pre-aggregation).

## Goals

- A second, visual read-path for the snapshot: overview statistics,
  equity curve, calendar, trades, and strategy comparison.
- Preserve the family's posture: self-hosted, no third-party service,
  no accounts, no telemetry. Data is decrypted and processed entirely
  in the browser; nothing leaves the machine.
- Semantics mirror the CLI where both expose the same figure. Same
  P&L component decomposition, same account-currency reporting, same
  mixed-currency guard, same timezone conventions for day bucketing.
- A deliberate visual identity, not a templated dashboard look (see
  Design language).

## Non-goals (v1)

- Journaling, notes, trade screenshots, or tagging (TradeZella-style
  journalling is a different product).
- Backtest comparison, Monte Carlo forecasting, or any forward
  simulation.
- Multi-snapshot merging or history diffing. One snapshot at a time.
- FX conversion to a home currency. Reporting stays in the account
  currency; cross-currency selections show per-currency totals rather
  than a silently mixed sum (the CLI's guard, ported).
- PWA/offline install, mobile apps, browser extensions.
- Any server-side component. If a need appears that genuinely cannot
  be met client-side, it gets its own design, not a bolt-on.

## Architecture

A fully client-side static single-page app.

- **Stack**: React 19, TypeScript, Vite. Static build output; no
  server-side rendering, no backend.
- **Hosting**: GitHub Pages (the repo's own deployment), and equally
  runnable from any static file server. The File System Access API
  requires a secure context, so `https://` or `http://localhost` —
  both deployment modes satisfy it.
- **Routing**: hash-based, so deep links work on static hosting
  without rewrite rules.
- **State**: Zustand store for the loaded snapshot handle, derived
  data, and the global filter state.
- **Privacy enforced, not promised**: the page ships a strict Content
  Security Policy (a `<meta http-equiv>` tag, since static hosts do
  not set response headers) with `connect-src 'none'`, so the deployed
  app cannot make network requests after asset load. The claim "your
  data never leaves the machine" is verifiable by inspecting the
  page's CSP and the absence of any fetch surface.

## Data pipeline

The browser-side mirror of the CLI's read path:

```
.age file ──► age decrypt ──► gunzip ──► JSON.parse ──► schema gate ──► worker aggregation ──► views
 (picker /     (typage,        (DecompressionStream)     (major == 1,
  drag-drop /   scrypt                                    minor ≤ vendored)
  saved handle) passphrase)
```

1. **File acquisition.** Drag-and-drop and a file picker work in every
   browser. On Chromium browsers, the File System Access API handle is
   persisted in IndexedDB so a returning visit offers one-click
   "Reopen <filename>" (re-prompting for read permission as the
   browser requires) and can detect that the file on disk is newer
   than the loaded data. Firefox and Safari degrade to the picker.
   Only the handle is persisted — never the passphrase, never
   decrypted content.
2. **Decryption.** [typage](https://github.com/FiloSottile/typage),
   the age implementation in TypeScript maintained by age's author,
   in scrypt/passphrase mode. The passphrase is prompted each session,
   held in memory only, and never written to any storage.
3. **Decompression.** Native `DecompressionStream('gzip')`.
4. **Schema gate.** `schema/snapshot.schema.json` is vendored from a
   tagged exporter release (the CLI's convention). The reader accepts
   the same major version and any minor ≤ its own, and rejects
   anything else with a readable message showing both versions.
5. **Worker aggregation.** Snapshots can decompress to hundreds of
   megabytes (see the exporter's snapshot-size note), so JSON parsing
   and aggregation run in a Web Worker. The main thread receives
   compact derived structures (stat summaries, chart series, indexed
   deal list), keeping the UI responsive at 100k+ deals.

Decrypted data lives only in memory. Closing the tab discards it.

## Derived semantics

Mirrors the CLI; where the CLI documents a convention, this repo
adopts it rather than re-deriving.

- **Net P&L** = profit + swap + commission + fee per closed deal,
  summed over the selection. Components are always available
  separately (income vs costs).
- **Equity curve** = cumulative net P&L over closed deals ordered by
  deal time, per selection.
- **Max drawdown** = largest peak-to-trough fall of that curve.
- **Win rate** counts deals with positive net P&L; profit factor =
  gross wins / |gross losses|; average win / average loss over the
  same split.
- **Currency.** All figures are in the account currency. A selection
  spanning currencies renders per-currency totals — never a mixed sum.
- **Day bucketing** (calendar, daily bars) follows the timezone
  semantics documented by the CLI for deal times.
- **Cash flows** are excluded from trading P&L and shown in their own
  view (deposits, withdrawals, and other balance-family records).

## Views

A persistent global filter bar — accounts, date range, symbol, magic —
applies to every view.

1. **Overview.** Stat tiles: net P&L, win rate, profit factor, max
   drawdown, trade count, average win, average loss, total costs
   (swap + commission + fee). Below: cumulative net-P&L curve,
   monthly P&L bars, and last-30-days daily bars.
2. **Calendar.** Month grid with per-day net P&L and trade count,
   colour intensity by magnitude, month and year totals, month/year
   navigation.
3. **Trades.** Virtualised, sortable, filterable table of closed deals
   with P&L component columns (profit, swap, commission, fee) and the
   raw MT5 fields. Tabs for open positions and cash flows.
4. **Strategies.** Grouping by account label or magic number:
   per-group stat rows (net P&L, win rate, profit factor, drawdown,
   trade count) with an equity sparkline per group, for side-by-side
   EA comparison.

## Design language

The visual identity is designed deliberately, before component code,
and committed to the repo as `docs/design-language.md`.

- **Two-pass design plan** following the frontend-design skill's
  process: a compact token system (4–6 named palette values;
  display, body, and data typefaces — the data face with tabular
  numerals, since this is a numbers-reading tool; layout concept;
  one signature element), then a review pass against the brief before
  any code.
- **Anti-default check.** Trading dashboards cluster hard around one
  look: near-black background, a single acid-green accent, glowing
  tiles. The reference material informs *what is on screen* (tiles,
  curve, calendar), not how it looks. Any part of the design plan
  that would come out the same for a generic dashboard brief gets
  revised.
- **Charts follow the dataviz skill's system.** P&L green/red is
  semantic colour, reserved for meaning and never used decoratively.
  Light and dark themes both supported and both designed; dark is the
  default.
- **Quality floor.** Responsive down to mobile, visible keyboard
  focus, `prefers-reduced-motion` respected, accessible contrast.
- **Implementation direction.** The implementation plan instructs
  implementers to invoke the frontend-design and dataviz skills before
  writing UI code.
- **Restraint rule.** The aesthetic risk is spent where it serves
  legibility (type treatment, the calendar's visual form) — this is a
  tool read weekly for years, and the data wins any fight with
  decoration.

## Key libraries

- **typage** — age decryption (scrypt mode).
- **ECharts** (canvas renderer) — equity curve, bars, sparklines.
  Canvas holds up at the deal counts the exporter anticipates where
  SVG chart libraries degrade.
- **TanStack Table + TanStack Virtual** — the trades grid.
- **Zustand** — state.
- **Tailwind CSS** — styling, themed via the design-language tokens.

## Error handling

Curated one-liners in the CLI's spirit, rendered in the UI's voice:

- Wrong passphrase (age decryption failure): say so, offer retry;
  distinguish from a file that is not age-encrypted at all.
- Not gzip after decrypt, or not valid JSON: name the failing stage.
- Unsupported schema version: show the snapshot's version and the
  supported range.
- Stale or permission-revoked file handle: re-request permission,
  fall back to the picker.
- Large-file progress: visible decrypt/parse progress states so a
  hundreds-of-MB snapshot never looks like a hang.

## Testing

- **Derivation functions are pure and unit-tested** (Vitest) against
  fixture snapshots — stats, equity curve, drawdown, calendar
  bucketing, currency guard. This is where correctness lives.
- **Component tests** with React Testing Library for filter behaviour
  and view rendering against fixture-derived data.
- **One Playwright end-to-end test**: load a fixture `.age` file
  (generated at test time from a committed plaintext fixture and a
  known passphrase), decrypt, and assert the dashboard renders the
  expected figures.
- **Schema drift**: CI fails if the vendored schema no longer matches
  the pinned exporter release.

## Repo hygiene

Same furniture as the sibling repos: MIT licence, British English and
no hyperbole in committed artifacts, CONTRIBUTING.md, SECURITY.md,
Renovate with SHA-pinned GitHub Actions, CI (lint, typecheck, tests,
coverage), and a Pages deployment from CI on main.

## Recorded decisions

- **Static SPA over local server or desktop app.** A local server
  needs per-OS keychain integration and serves plaintext on a port; a
  Tauri app needs per-OS builds and signing. The static SPA has the
  smallest surface, the strongest verifiable privacy story, and fits
  the family ethos. Revisit only if the manual passphrase step proves
  unacceptable in practice.
- **File handle persisted, passphrase never.** One click of friction
  per session is the accepted cost of keeping a keychain-grade secret
  out of browser storage.
- **ECharts over Recharts/SVG.** Chosen for canvas rendering at large
  deal counts, accepting a heavier dependency.
- **Semantics defer to the CLI.** Where both tools show the same
  figure they must agree; the CLI's documented conventions (P&L
  decomposition, currency guard, timezone) are adopted wholesale.
