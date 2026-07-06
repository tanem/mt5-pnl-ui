# README Screenshot and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Playwright-generated Overview screenshot to the README and apply the polish changes from the approved spec (`docs/superpowers/specs/2026-07-06-readme-screenshot-and-polish-design.md`).

**Architecture:** A new Playwright spec captures `docs/screenshot.png` from the production build using the existing synthetic e2e fixture. The Playwright config is split into two projects so the capture spec never runs as part of `npm run e2e`. The README then embeds the image and gets link/removal edits.

**Tech Stack:** Playwright (already a dev dependency), npm scripts, Markdown.

## Global Constraints

- British/Commonwealth English in comments and docs; plain, factual tone — no hyperbole (repo convention).
- The screenshot must be generated only from the synthetic e2e fixture `e2e/fixtures/snapshot.json.gz.age`; no real trading data may ever appear in a committed image.
- Do not hand-bump any pinned dependency or action versions (Renovate-managed). Adding an npm *script* is fine.
- Command changes update CLAUDE.md and README.md in the same change (repo convention; README has no command list, so CLAUDE.md is the touchpoint here).
- `npm run e2e` behaviour must be unchanged: the same three tests in `e2e/app.spec.ts` run and pass.

---

### Task 1: Screenshot generation script

**Files:**
- Create: `e2e/fixture.ts`
- Create: `e2e/screenshot.spec.ts`
- Modify: `e2e/app.spec.ts` (use the shared helper)
- Modify: `playwright.config.ts` (project split)
- Modify: `package.json` (scripts block only)
- Modify: `CLAUDE.md` (Commands block + Gotchas)
- Output: `docs/screenshot.png` (generated, committed)

**Interfaces:**
- Consumes: `e2e/fixtures/snapshot.json.gz.age` (existing committed fixture, passphrase `e2e-passphrase`); the existing Playwright `webServer` config (production build served at `http://localhost:4173/mt5-pnl-ui/`).
- Produces: `npm run screenshot` (regenerates `docs/screenshot.png`); `dropFixture(page: Page): Promise<void>` exported from `e2e/fixture.ts` (used by both specs); Playwright projects named `e2e` and `screenshot`. Task 2 relies on `docs/screenshot.png` existing in the repo.

- [ ] **Step 1: Extract the shared fixture helper**

Create `e2e/fixture.ts`:

```ts
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = readFileSync("e2e/fixtures/snapshot.json.gz.age");

export async function dropFixture(page: Page): Promise<void> {
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "snapshot.json.gz.age"),
    );
    return dt;
  }, Array.from(fixture));
  await page.dispatchEvent("main", "drop", { dataTransfer });
}
```

In `e2e/app.spec.ts`, replace the top of the file — currently:

```ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = readFileSync("e2e/fixtures/snapshot.json.gz.age");

async function dropFixture(page: import("@playwright/test").Page) {
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(
      new File([new Uint8Array(bytes)], "snapshot.json.gz.age"),
    );
    return dt;
  }, Array.from(fixture));
  await page.dispatchEvent("main", "drop", { dataTransfer });
}
```

with:

```ts
import { expect, test } from "@playwright/test";
import { dropFixture } from "./fixture";
```

The three tests below it are untouched.

- [ ] **Step 2: Verify the existing suite still passes**

Run: `npm run e2e`
Expected: 3 passed (`decrypts a snapshot…`, `wrong passphrase…`, `the served page carries the lockdown CSP`).

Also run: `npm run lint`
Expected: clean (eslint covers `e2e/`).

- [ ] **Step 3: Commit the refactor**

```bash
git add e2e/fixture.ts e2e/app.spec.ts
git commit -m "refactor: extract shared e2e fixture drop helper"
```

- [ ] **Step 4: Split the Playwright config into two projects**

Replace the whole of `playwright.config.ts` with:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  projects: [
    { name: "e2e", testIgnore: "**/screenshot.spec.ts" },
    // Not a test: regenerates docs/screenshot.png (npm run screenshot).
    { name: "screenshot", testMatch: "**/screenshot.spec.ts" },
  ],
  use: { baseURL: "http://localhost:4173/mt5-pnl-ui/" },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/mt5-pnl-ui/",
    reuseExistingServer: !process.env.CI,
  },
});
```

In `package.json`, change the scripts block — currently ends:

```json
    "lint": "eslint src e2e --no-error-on-unmatched-pattern",
    "e2e": "playwright test"
```

to:

```json
    "lint": "eslint src e2e --no-error-on-unmatched-pattern",
    "e2e": "playwright test --project=e2e",
    "screenshot": "playwright test --project=screenshot"
```

- [ ] **Step 5: Write the capture spec**

Create `e2e/screenshot.spec.ts`:

```ts
// Not part of the e2e suite: captures docs/screenshot.png for the
// README (npm run screenshot). Rerun and commit the image after
// visible UI changes.
import { expect, test } from "@playwright/test";
import { dropFixture } from "./fixture";

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

test("captures the Overview view for the README", async ({ page }) => {
  await page.goto("");
  await dropFixture(page);
  await page.getByLabel(/passphrase/i).fill("e2e-passphrase");
  await page.getByRole("button", { name: /unlock/i }).click();

  await expect(
    page.getByRole("region", { name: /usd overview/i }),
  ).toBeVisible();
  // Fixed pause so the ECharts entry animations finish before capture;
  // over-waiting is harmless here, this is not an assertion.
  await page.waitForTimeout(1500);

  await page.screenshot({ path: "docs/screenshot.png" });
});
```

- [ ] **Step 6: Generate the screenshot and verify the split**

Run: `npm run screenshot`
Expected: 1 passed; `docs/screenshot.png` created (should be roughly 2560×1600 pixels given `deviceScaleFactor: 2`).

Inspect the image (open it) and confirm: it shows the Overview view with the loaded fixture — headline statistic cards, the cumulative net P&L chart, USD section visible — and only synthetic fixture data (account names/figures from the e2e fixture, e.g. "Trend EA").

Run: `npm run e2e`
Expected: still exactly 3 passed — the capture spec must NOT appear in this run.

Run: `npm run lint` and `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Update CLAUDE.md**

In the Commands block, after the `npm run e2e` line, add:

```
npm run screenshot   # regenerate docs/screenshot.png (Overview, e2e fixture)
```

In the Gotchas section, add this bullet:

```markdown
- **`docs/screenshot.png` is generated**, by `npm run screenshot` (a
  Playwright project excluded from `npm run e2e`, capturing the
  Overview view from the synthetic e2e fixture). Refresh and commit it
  after visible UI changes; never replace it with a hand-taken image.
```

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts package.json e2e/screenshot.spec.ts docs/screenshot.png CLAUDE.md
git commit -m "feat: add generated README screenshot script"
```

---

### Task 2: README polish

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `docs/screenshot.png` committed by Task 1.
- Produces: the final README; nothing downstream depends on it.

All edits below give the exact current text and its replacement. Keep the existing hard-wrap width (~75 characters).

- [ ] **Step 1: Remove the static Pages badge**

Delete this line from the badge block (licence and ci badges stay):

```markdown
[![Pages](https://img.shields.io/badge/pages-live-blue)](https://tanem.github.io/mt5-pnl-ui/)
```

- [ ] **Step 2: Embed the screenshot under the one-liner**

Immediately after the blockquote line

```markdown
> Reads an encrypted MT5 snapshot, renders a P&L dashboard in the browser.
```

insert (with a blank line either side):

```markdown
![The Overview view: headline statistic cards, a cumulative net P&L
curve, and monthly bar charts, rendered one section per account
currency](docs/screenshot.png)
```

The ASCII architecture diagram stays where it is, after the image.

- [ ] **Step 3: Link the exporter and age on first prose mention**

Replace:

```markdown
The exporter runs on the Windows host where MT5 lives and writes one
encrypted file. This app runs in a browser — any OS, no install — decrypts
```

with:

```markdown
The [exporter](https://github.com/tanem/mt5-pnl-exporter) runs on the
Windows host where MT5 lives and writes one
[age](https://age-encryption.org)-encrypted file. This app runs in a
browser — any OS, no install — decrypts
```

Later plain-text mentions of `mt5-pnl-exporter` (e.g. in "Opening a
snapshot") stay unlinked — first mention only.

- [ ] **Step 4: Remove the Contents section**

Delete the whole section, from the `## Contents` heading through the
`- [Licence](#licence)` list item (inclusive), plus the trailing blank
line, so `## Why` directly follows the paragraph under the diagram.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm test`
Expected: clean / all unit tests pass (README changes cannot break
them; this confirms nothing else was accidentally touched).

Check the rendered README (e.g. `grep -n "screenshot.png\|## Contents\|pages-live" README.md`):
Expected: one `screenshot.png` reference, no `## Contents`, no `pages-live`.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add Overview screenshot and polish README"
```
