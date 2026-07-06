# CLAUDE.md

Browser dashboard for the encrypted snapshot written by mt5-pnl-exporter
(`snapshot.json.gz.age`) — a fully client-side single-page app, no
backend. Semantics mirror
[mt5-pnl-cli](https://github.com/tanem/mt5-pnl-cli); this file assumes
you've read its README [Notes](https://github.com/tanem/mt5-pnl-cli#notes).
Design spec:
[`docs/superpowers/specs/2026-07-05-mt5-pnl-ui-v1-design.md`](docs/superpowers/specs/2026-07-05-mt5-pnl-ui-v1-design.md).

## Commands

```bash
npm ci               # install
npm run dev          # dev server (Vite; no CSP — see Gotchas)
npm test             # unit tests (Vitest + Testing Library, jsdom)
npm run e2e          # Playwright end-to-end tests (real worker, real build)
npm run screenshot   # regenerate docs/screenshot.png (Overview, e2e fixture)
npm run build        # tsc --noEmit && vite build (injects the CSP)
npm run typecheck    # tsc --noEmit only
npm run lint         # eslint src e2e
```

## Architecture

Data flow: `.age` file → **pipeline** → **worker** → **store** →
**selectors** → **views**.

- `src/lib/snapshot/pipeline.ts` — `decryptSnapshot`: age decrypt
  (`age-encryption`, scrypt/passphrase) → gunzip
  (`DecompressionStream('gzip')`) → `JSON.parse` → schema gate
  (`src/lib/snapshot/version.ts`, `SUPPORTED_SCHEMA`). Mirrors the CLI's
  read path.
- `src/worker/` — `snapshot.worker.ts` runs the pipeline off the main
  thread (snapshots can be hundreds of MB decompressed); `client.ts`
  (`workerRunner`) is the main-thread side, posting `{ id, bytes,
  passphrase }` and resolving/rejecting per-request promises keyed by
  `id`.
- `src/store/app.ts` — Zustand store (`createAppStore`, takes a
  `PipelineRunner` so tests can inject a fake). Holds `status`, `stage`,
  `error`, `snapshot`, `filters`. `load()` drives the worker; `reset()`
  clears everything back to the load screen.
- `src/store/selectors.ts` — `useAccounts`, `useFilteredDeals`
  (applies the global `Filters`), `useCurrencyGroups` (splits filtered
  deals by account currency — see the mixed-currency guard below).
- `src/views/` — `Overview.tsx`, `CalendarView.tsx`, `Trades.tsx`,
  `Strategies.tsx`, each consuming `useCurrencyGroups()` and rendering
  one section per currency.
- `src/lib/persist/handle.ts` — IndexedDB (`idb-keyval`) storage of the
  `FileSystemFileHandle` only, for Chromium's one-click reopen.
- `src/lib/derive/` — pure functions: `filters.ts` (the global filter),
  `currency.ts` (`splitByCurrency`), `stats.ts` (net P&L, win/loss,
  profit factor, expectancy), `equity.ts` (cumulative curve, max
  drawdown), `buckets.ts` (UTC day/month grouping).

## Gotchas

- **Semantics defer to mt5-pnl-cli's README Notes** — net P&L
  components, win/loss/breakeven, max drawdown (realised P&L, not
  equity), UTC bucketing, the mixed-currency guard. Don't redefine them
  here; if a figure needs to diverge from the CLI, that's a design
  decision, not a quick fix.
- **UTC-only bucketing.** `buckets.ts` always buckets by UTC day/month;
  there is no local-timezone mode. Match the CLI, don't add one.
- **Mixed-currency guard.** Never sum across `useCurrencyGroups()`
  entries. Every view renders one section per currency and leaves it at
  that — no combined total, ever, even as a convenience.
- **The passphrase must never touch storage.** It lives in component
  state (`LoadScreen`) and is passed straight through to the worker; it
  is never written to IndexedDB, `localStorage`, or a log. Only the file
  *handle* is persisted (`src/lib/persist/handle.ts`).
- **CSP is build-only.** `vite.config.ts`'s `injectCsp` plugin
  (`apply: "build"`) adds the `connect-src 'none'` meta tag to
  `dist/index.html`; `npm run dev` serves an unrestricted page. Verify
  the CSP with `npm run build && grep "connect-src" dist/index.html`,
  not by loading the dev server.
- **The worker is mocked in unit tests.** Every test that renders
  through the store does `vi.mock("../worker/client", () => ({
  workerRunner: vi.fn() }))` (or the App-level equivalent) — unit tests
  never exercise `snapshot.worker.ts` for real. Only the Playwright e2e
  suite runs the actual worker against a real encrypted fixture.
- **Chart colours come only from `src/lib/chartTheme.ts`.** `POS`,
  `NEG`, `LINE`, `AXIS`, `GRID`, and the shared `axis` spread are the
  single source for every ECharts colour; don't hard-code a hex value in
  a view. The palette is static across light/dark on purpose — see the
  comment at the top of that file.
- **`tests/setup.ts` polyfills jsdom gaps tests silently depend on**:
  `DecompressionStream` (Node's, not jsdom's), `Blob.prototype.stream`
  (wrapped from `arrayBuffer()`), and non-zero `offsetWidth`/`offsetHeight`
  (jsdom does no layout, which would otherwise suppress
  `@tanstack/react-virtual`'s rows). If a test using gzip, `Blob`, or a
  virtualised table fails mysteriously, check this file loaded.
- **`filters.accounts === null` means "all accounts"; `[]` means "match
  nothing".** `FilterBar` relies on this: toggling every account back on
  sets `accounts: null` rather than the full list. Don't conflate an
  empty array with "no filter" when touching `applyFilters`.
- **React hooks lint is strict — no setState-in-effect.** See
  `LoadScreen.tsx`'s comment: it clears the passphrase by comparing
  `status` to a `prevStatus` state variable and adjusting during render
  (React's documented pattern for "state that depends on a change in
  props"), specifically to avoid a `useEffect` that both reads and sets
  state. Follow that pattern rather than reintroducing a setState effect.
- **Schema bumps touch three things together**: `schema/EXPORTER_TAG`
  (the vendored exporter release), `schema/snapshot.schema.json` (the
  vendored schema file itself), and `SUPPORTED_SCHEMA` in
  `src/lib/snapshot/version.ts`. Update all three in the same change.
- **`docs/screenshot.png` is generated**, by `npm run screenshot` (a
  Playwright project excluded from `npm run e2e`, capturing the
  Overview view from the synthetic e2e fixture). Refresh and commit it
  after visible UI changes; never replace it with a hand-taken image.

## Conventions

- British/Commonwealth English in comments and docs. No hyperbole.
- Dependencies are Renovate-managed (`renovate.json`, Task 18); don't
  hand-bump pinned actions or package versions.
- After changing commands, architecture, or a gotcha above, update this
  file and README.md in the same change.
