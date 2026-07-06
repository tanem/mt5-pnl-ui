# Calendar Flat P&L Wash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give traded calendar day cells a flat green/red background wash (12% alpha), replacing the magnitude-scaled `--heat` treatment that never rendered.

**Architecture:** CSS-only visual change plus removal of the now-dead `--heat` plumbing in `CalendarView.tsx`. The bug being fixed is a Tailwind cascade-layer conflict: the `.day-cell[data-tone]` background rules in `@layer base` lose to the `bg-surface` utility (`utilities` layer wins by layer order). The fix moves the resting background into the `.day-cell` base rule and drops the utility class, then guards the computed style in the e2e suite — the only place real CSS is loaded (unit tests run in jsdom, which never sees the built stylesheet).

**Tech Stack:** React + Tailwind v4 (CSS custom properties in `src/index.css`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-07-calendar-flat-wash-design.md`

## Global Constraints

- British/Commonwealth English in comments and docs; plain and factual, no hyperbole.
- Chart/P&L colours come only from the existing tokens — do not introduce new hex values; the wash uses `--pos-rgb` / `--neg-rgb` as-is.
- Wash alpha is exactly `0.12` in both themes.
- Never sum across currencies; this plan touches no aggregation logic and must keep it that way.
- `docs/screenshot.png` is Overview-only and is NOT regenerated for this change.

---

### Task 1: Flat wash + computed-style e2e guard

**Files:**
- Modify: `e2e/app.spec.ts` (calendar step of the first test, currently lines 17–22)
- Modify: `src/index.css` (the `.day-cell` block inside `@layer base`, currently lines 141–157)
- Modify: `src/views/CalendarView.tsx` (import line 1, `peak` computation lines 87–94, day-cell JSX lines 155–169)

**Interfaces:**
- Consumes: existing `data-tone="pos" | "neg"` attribute on `.day-cell` elements (set by `CalendarView.tsx`, unchanged); tokens `--pos-rgb: 15 122 69` and `--neg-rgb: 192 48 60` (light theme values in `src/index.css`).
- Produces: `.day-cell` styling contract used by Task 2's prose: flat `rgb(var(--pos-rgb) / 0.12)` / `rgb(var(--neg-rgb) / 0.12)` backgrounds, tinted borders unchanged; `--heat` no longer exists anywhere in the repo.

- [ ] **Step 1: Write the failing e2e assertions**

In `e2e/app.spec.ts`, extend the calendar step of the `"decrypts a snapshot and renders the dashboard"` test. Replace:

```ts
  // Navigate all views
  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Week" }).first(),
  ).toBeVisible();
```

with:

```ts
  // Navigate all views
  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page.getByRole("grid").first()).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Week" }).first(),
  ).toBeVisible();
  // Traded days carry the flat P&L wash — a computed-style guard, because
  // jsdom unit tests never load the built stylesheet (this regressed once
  // via cascade-layer order without any test noticing).
  await expect(page.locator('.day-cell[data-tone="pos"]').first()).toHaveCSS(
    "background-color",
    "rgba(15, 122, 69, 0.12)",
  );
  await expect(page.locator('.day-cell[data-tone="neg"]').first()).toHaveCSS(
    "background-color",
    "rgba(192, 48, 60, 0.12)",
  );
```

(The rgba values are the light-theme `--pos-rgb`/`--neg-rgb` at the 0.12 wash alpha; Playwright's default colour scheme is light.)

- [ ] **Step 2: Run the e2e test to verify it fails**

Run: `npx playwright test --project=e2e app.spec.ts`
Expected: FAIL on the first `toHaveCSS` — received `rgb(255, 255, 255)` (the `bg-surface` utility still wins over the tone background).

- [ ] **Step 3: Replace the heat CSS with the flat wash**

In `src/index.css`, replace the day-cell block (comment and three rules, currently lines 141–157):

```css
  /*
    Calendar day cells: the signature element. Background intensity scales
    with the day's magnitude (--heat, 0..1 relative to the month's peak), so
    the eye ranks winning and losing days by weight before reading a figure.
    Sign is carried by hue AND the signed number, never by hue alone.
  */
  .day-cell {
    border: 1px solid var(--border);
  }
  .day-cell[data-tone="pos"] {
    background: rgb(var(--pos-rgb) / calc(0.1 + 0.5 * var(--heat, 0)));
    border-color: color-mix(in srgb, var(--pos) 45%, var(--border));
  }
  .day-cell[data-tone="neg"] {
    background: rgb(var(--neg-rgb) / calc(0.1 + 0.5 * var(--heat, 0)));
    border-color: color-mix(in srgb, var(--neg) 45%, var(--border));
  }
```

with:

```css
  /*
    Calendar day cells: the signature element. Traded days carry a flat
    wash of the profit or loss colour — the same strength for every day,
    deliberately not scaled by magnitude, so a large losing day carries no
    more visual force than a small one. Sign is read at a glance; weight
    is left to the signed figures and the week/month totals. Sign is
    carried by hue AND the signed number, never by hue alone. The resting
    background lives here rather than as a bg-surface utility on the cell:
    a utility would win the cascade over these @layer base rules by layer
    order and blank the wash (it did once).
  */
  .day-cell {
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .day-cell[data-tone="pos"] {
    background: rgb(var(--pos-rgb) / 0.12);
    border-color: color-mix(in srgb, var(--pos) 45%, var(--border));
  }
  .day-cell[data-tone="neg"] {
    background: rgb(var(--neg-rgb) / 0.12);
    border-color: color-mix(in srgb, var(--neg) 45%, var(--border));
  }
```

- [ ] **Step 4: Remove the dead `--heat` plumbing from `CalendarView.tsx`**

Three edits in `src/views/CalendarView.tsx`:

4a. Line 1 — drop the now-unused type import:

```ts
import { Fragment, useMemo, useState } from "react";
```

4b. In `MonthGrid`, remove `peak` (its only consumer was the `--heat` style). Replace:

```ts
  let monthNet = 0;
  let monthTrades = 0;
  let peak = 0; // largest |net| this month — the heat scale's reference
  for (const [k, b] of days) {
    if (k.startsWith(prefix)) {
      monthNet += b.net;
      monthTrades += b.trades;
      peak = Math.max(peak, Math.abs(b.net));
    }
  }
```

with:

```ts
  let monthNet = 0;
  let monthTrades = 0;
  for (const [k, b] of days) {
    if (k.startsWith(prefix)) {
      monthNet += b.net;
      monthTrades += b.trades;
    }
  }
```

4c. In the day-cell JSX, delete the `style` prop and drop `bg-surface` from the className. Replace:

```tsx
                <div
                  key={key}
                  role="gridcell"
                  aria-label={key.slice(8)}
                  data-tone={
                    days.get(key) ? (days.get(key)!.net >= 0 ? "pos" : "neg") : undefined
                  }
                  style={
                    days.get(key) && peak > 0
                      ? ({
                          "--heat": Math.abs(days.get(key)!.net) / peak,
                        } as CSSProperties)
                      : undefined
                  }
                  className="day-cell min-h-16 rounded-md bg-surface p-1.5 font-mono text-sm tabular-nums"
                >
```

with:

```tsx
                <div
                  key={key}
                  role="gridcell"
                  aria-label={key.slice(8)}
                  data-tone={
                    days.get(key) ? (days.get(key)!.net >= 0 ? "pos" : "neg") : undefined
                  }
                  className="day-cell min-h-16 rounded-md p-1.5 font-mono text-sm tabular-nums"
                >
```

- [ ] **Step 5: Run the e2e suite to verify it passes**

Run: `npx playwright test --project=e2e`
Expected: all 3 tests PASS (the new assertions now compute `rgba(15, 122, 69, 0.12)` / `rgba(192, 48, 60, 0.12)`).

- [ ] **Step 6: Run the remaining checks**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all PASS. (If lint flags an unused import in `CalendarView.tsx`, Step 4a was missed.)

- [ ] **Step 7: Visual inspection, both themes**

Run: `npm run visual`
Open `visual-review/calendar-light.png` and `visual-review/calendar-dark.png`: every traded day shows the same-strength green or red wash with a tinted border; untraded days are plain surface; the week-total column is unchanged.

- [ ] **Step 8: Grep that `--heat` is gone**

Run: `grep -rn "heat" src/ e2e/`
Expected: no matches.

- [ ] **Step 9: Commit**

```bash
git add e2e/app.spec.ts src/index.css src/views/CalendarView.tsx
git commit -m "fix: render a flat P&L wash on traded calendar days

The magnitude-scaled heat background never rendered: the rules live in
@layer base and lost the cascade to the bg-surface utility. Move the
resting background into the .day-cell rule, make the wash a flat 12%
of the P&L colour by design (sign at a glance; weight stays with the
figures), delete the dead --heat plumbing, and guard the computed
style in e2e.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite the design-language signature-element prose

**Files:**
- Modify: `docs/design-language.md` (the "Signature element" paragraph in "Layout and signature", currently lines 123–130)

**Interfaces:**
- Consumes: the styling contract from Task 1 — flat 12% wash of `--pos`/`--neg` over the surface, tinted border, no magnitude scaling, `data-tone` as the shared mechanism.
- Produces: nothing consumed by other tasks; docs only.

- [ ] **Step 1: Replace the heat-calendar paragraph**

In `docs/design-language.md`, replace:

```markdown
**Signature element — the P&L heat-calendar.** The calendar's day cells are the one
memorable device. Each cell's background intensity scales with the day's magnitude
relative to that month's peak (`--heat`, 0..1, driving the alpha of the profit or
loss colour), so the eye ranks winning and losing days by weight before reading a
single figure — exactly the scan a trader makes ("which days moved the account?").
The same tone language echoes, quietly, as a left edge on stat tiles, tying tiles,
calendar, and charts into one visual system. The boldness is spent here, where it
serves the reading; it is spent nowhere else.
```

with:

```markdown
**Signature element — the P&L tone-wash calendar.** The calendar's day cells are
the one memorable device. Every traded day carries a flat wash of the profit or
loss colour (12% alpha over the surface) with a matching border tint, so a month
reads as green and red days at a glance. The wash is deliberately not scaled by
magnitude: a large losing day carries no more visual force than a small one.
Sign is instant; weight is left to the signed figures and the week and month
totals, which is where a trader reads "which days moved the account?". The same
tone language echoes, quietly, as a left edge on stat tiles, tying tiles,
calendar, and charts into one visual system. The boldness is spent here, where it
serves the reading; it is spent nowhere else.
```

- [ ] **Step 2: Check no other `--heat` references remain in docs**

Run: `grep -rn "heat" docs/design-language.md README.md CLAUDE.md`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design-language.md
git commit -m "docs: describe the calendar's flat tone-wash in the design language

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
