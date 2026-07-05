# Security policy

## Scope

This app handles one secret: the **snapshot decryption passphrase**. It
is entered into a form field each session, held in memory only for the
life of the tab, and never written to any storage (IndexedDB,
`localStorage`, cookies) or sent anywhere — the built page's Content
Security Policy (`connect-src 'none'`) prevents any network request after
the initial asset load. The decrypted snapshot itself is also memory-only
and is discarded when the tab closes.

The only thing persisted across sessions is a
[File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
file handle (Chromium browsers only), saved in IndexedDB so a returning
visit can offer one-click reopen. A handle is a reference the browser
manages, not file contents or a secret.

Vulnerabilities in scope:

- Passphrase disclosure in the DOM, browser storage, or anywhere outside
  the in-memory form state
- The decrypt pipeline (age decrypt → gunzip → JSON parse → schema gate)
  bypassed, weakened, or made to accept tampered input undetected
- A way for the built app to make a network request despite the CSP
- Account data (balances, trade history) leaking anywhere other than the
  rendered page
- Dependency vulnerabilities with a plausible exploitation path in this
  app

Out of scope:

- mt5-pnl-exporter and mt5-pnl-cli — see their own security policies
  ([exporter](https://github.com/tanem/mt5-pnl-exporter/blob/main/SECURITY.md),
  [cli](https://github.com/tanem/mt5-pnl-cli/blob/main/SECURITY.md))
- A compromised OS user session or browser profile — the documented
  trust boundary; anyone with that access can read whatever the browser
  can read
- Browser vendor bugs (e.g. a File System Access or CSP implementation
  flaw) — report those upstream

## Supply-chain controls

- **GitHub Actions are pinned to commit SHAs** (not mutable tags), so a
  compromised or retagged action cannot inject code into CI.
  [Renovate](https://docs.renovatebot.com/) keeps the pins current via
  `helpers:pinGitHubActionDigests`.
- Dependency update PRs (Renovate) must pass CI before auto-merging;
  majors require manual review. See [`renovate.json`](renovate.json).
- **The Content Security Policy is enforced at build time**, not just
  documented: `vite.config.ts` injects `connect-src 'none'` (and a
  matching restrictive policy for scripts, styles, and other fetch
  directives) into the built `index.html`. Verify it on any deployment by
  viewing the page source.

## Reporting

**Do not open a public GitHub issue for security vulnerabilities.**
Public issues expose the vulnerability before a fix is available.

Report privately via the Security tab —
[Report a vulnerability](https://github.com/tanem/mt5-pnl-ui/security/advisories/new).
This opens a private workspace visible only to you and the maintainer.

You will receive a response within 7 days. Once a fix is ready, I'll
agree a disclosure date with you before publishing.
