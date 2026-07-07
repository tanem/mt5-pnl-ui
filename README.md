# mt5-pnl-ui

[![Licence](https://img.shields.io/github/license/tanem/mt5-pnl-ui)](LICENSE)
[![ci](https://github.com/tanem/mt5-pnl-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/tanem/mt5-pnl-ui/actions/workflows/ci.yml)

> Reads an encrypted MT5 snapshot, renders a P&L dashboard in the browser.

![The Overview view: headline statistic cards, a cumulative net P&L
curve, and monthly bar charts, rendered one section per account
currency](docs/screenshot.png)

```
   ┌──────────────┐  writes   ┌────────────────┐  reads   ┌──────────────┐
   │ mt5-pnl-     │ ────────► │ snapshot.json  │ ───────► │ mt5-pnl-cli  │
   │ exporter     │           │ .gz.age        │          │ mt5-pnl-ui   │
   │              │           │ (the contract) │          │ (this repo)  │
   └──────┬───────┘           └────────────────┘          └──────────────┘
          ▲ MT5 deal history
   ┌──────┴───────┐
   │ Windows host │
   └──────────────┘
```

The [exporter](https://github.com/tanem/mt5-pnl-exporter) runs on the
Windows host where MT5 lives and writes one
[age](https://age-encryption.org)-encrypted file. This app runs in a
browser — any OS, no install — decrypts
that file in memory, and renders the same figures as
[mt5-pnl-cli](https://github.com/tanem/mt5-pnl-cli), visually.

## Why

- **Self-hosted, nothing leaves the machine.** The app is a static bundle;
  once loaded it makes no network requests at all. This is enforced, not
  just promised: the built page ships a Content Security Policy with
  `connect-src 'none'`, so the browser refuses any fetch, XHR, or
  WebSocket the code might attempt. Verify it yourself — view-source the
  page and look for the `Content-Security-Policy` `<meta>` tag, or open
  DevTools' Network tab, load a snapshot, and confirm nothing appears
  after the initial asset load.
- **One file in, a dashboard out.** Decryption, decompression, and
  aggregation all happen client-side; the decrypted snapshot exists only
  in the tab's memory.
- **Semantics mirror the CLI.** Same net P&L decomposition, same
  mixed-currency guard, same UTC bucketing — see [Semantics](#semantics).

## Use it

The hosted build is at **<https://tanem.github.io/mt5-pnl-ui/>** — open it
and pick a snapshot.

To self-host, build and serve the static output from any web server:

```bash
npm ci
npm run build
npx serve dist   # or any static file server
```

The File System Access API (used for the one-click reopen described
below) requires a secure context — `https://` or `http://localhost`. A
plain `file://` open works for the drag-and-drop and file-picker paths
but not for reopen.

## Opening a snapshot

Each session you provide the `snapshot.json.gz.age` file written by
mt5-pnl-exporter and its decryption passphrase — drag-and-drop, a file
picker, or (Chromium browsers only) a saved file handle:

- **What's persisted**: on Chromium, the File System Access API file
  handle is saved in IndexedDB, so a returning visit offers a one-click
  "Reopen <filename>" button (re-prompting for read permission as the
  browser requires).
- **What's never persisted**: the passphrase, and the decrypted snapshot
  contents. Both live in memory only, for the life of the tab.
- **Firefox and Safari** don't implement the File System Access API, so
  they fall back to drag-and-drop or the standard file-picker input —
  the reopen shortcut just isn't offered.

## Views

- **Overview** — headline statistics (net P&L, win rate, profit factor,
  max drawdown, trade count, average win/loss, costs), a cumulative net
  P&L curve, and monthly/last-30-days bar charts. Also shows lifetime
  account returns (deposited, withdrawn, transferred between in-scope
  accounts, floating, profit, percentage gain) per currency group,
  affected by the account filter only; deposited and withdrawn count
  external flows only.
- **Calendar** — a month grid with one cell per trading day, given a flat
  colour wash by net P&L sign, plus a week-total column and a running
  month total.
- **Trades** — closed deals, open positions, and cash flows in sortable,
  virtualised tables (closed deals also carry a computed net column).
- **Strategies** — the same summary statistics as Overview, broken down
  per account or per magic number, each row with an equity sparkline.

Every view respects the global filter bar (accounts, date range, symbol,
magic numbers) and, where accounts in scope span more than one currency,
renders one section per currency rather than combining them (see
[Semantics](#semantics)).

## Semantics

Figures mirror [mt5-pnl-cli](https://github.com/tanem/mt5-pnl-cli) — see
its README [Notes](https://github.com/tanem/mt5-pnl-cli#notes) for the
definitions this app uses without restating them:

- Net P&L components (`trade_profit + commission + swap + fee`)
- Win / loss / breakeven classification
- Max drawdown on the *realised* P&L curve, not account equity
- UTC day/week/month bucketing
- The mixed-currency guard — figures are never summed across account
  currencies; this app renders one section per currency instead of
  suppressing the combined view

## Schema compatibility

[`schema/snapshot.schema.json`](schema/snapshot.schema.json) is vendored
from exporter release [`schema/EXPORTER_TAG`](schema/EXPORTER_TAG)
(currently `v1.0.4`). The app accepts the same major schema version and
any minor at or below its own, and rejects anything else with a message
naming both versions.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). For
security reports, see [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
