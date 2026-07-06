# Contributing

Thanks for your interest. This is a small project — issues and PRs are
welcome.

## One-time setup

```bash
npm ci
```

## Running tests and checks

```bash
npm run dev          # local dev server (Vite, no CSP — see CLAUDE.md)
npm test             # unit tests (Vitest)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run e2e          # Playwright end-to-end tests
npm run visual       # capture per-view screenshots to visual-review/ (inspection aid, not a test)
```

`npm run build` runs the typecheck and the production build; it also
injects the Content Security Policy into `dist/index.html` (dev mode does
not carry it — see [CLAUDE.md](CLAUDE.md)).

## Smoke-test against a real snapshot

Before merging a change that touches the decrypt pipeline or a view,
exercise it against a real exporter snapshot:

```bash
npm run build
npx serve dist
```

Open the served URL, pick a real `snapshot.json.gz.age`, enter its
passphrase, and confirm the dashboard renders and the figures match what
`mt5-pnl-cli pnl`/`accounts` report for the same snapshot.

## Dependency updates

Dependencies are kept current by
[Renovate](https://docs.renovatebot.com/) (config:
[`renovate.json`](renovate.json)), covering npm packages and GitHub
Actions:

- Actions are pinned to commit SHAs (not mutable tags) for supply-chain
  integrity; Renovate keeps the SHA and its version comment current.
- Digest, minor, and patch updates auto-merge once CI passes; majors open
  a PR for review.

Don't hand-bump these versions — let Renovate's PRs flow through.

## Releasing

The `main` branch deploys automatically to GitHub Pages on every push via
[`deploy.yml`](.github/workflows/deploy.yml) — there is no separate
release or tag step.

## Conventions

See [`CLAUDE.md`](CLAUDE.md) — the canonical reference for coding style,
architectural rules, and gotchas (British/Commonwealth English, the
worker/store/selectors/views architecture, the mixed-currency guard, the
build-only CSP). It's loaded automatically by Claude Code but reads as a
normal project doc.
