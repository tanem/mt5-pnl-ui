# Dashboard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix float noise in chart tooltips, fix the Closed-deals table layout (column widths, wrapping, alignment), and add a weekly-total column to the calendar.

**Architecture:** Three independent view-level changes. A shared 2-dp number formatter is added to `src/lib/format.ts` and used by chart tooltips and the trades tables. The calendar change groups the existing month cells into weeks of seven and appends one summary cell per week, computed from the existing UTC day buckets — no new derivation code.

**Tech Stack:** React 19, ECharts (`echarts/core`), TanStack Table + Virtual, Tailwind v4, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-06-dashboard-polish-design.md`

## Global Constraints

- British/Commonwealth English in comments and docs; no hyperbole.
- Never sum across currencies; all new figures stay inside one currency section.
- UTC-only bucketing; weeks are Monday-start, matching `buildMonthCells`.
- Chart colours come only from `src/lib/chartTheme.ts`; UI colours only from the theme tokens (`text-pos`, `text-muted`, …) — no hard-coded hex.
- Unit tests mock the worker (`vi.mock("../worker/client", …)`); only Playwright runs it for real.
- No dependency changes (Renovate-managed).
- README.md / CLAUDE.md updated in the same change when behaviour they describe changes.

---

### Task 1: 2-dp chart tooltip formatting

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`
- Modify: `src/views/Overview.tsx:57-93`
- Modify: `src/views/Overview.test.tsx`

**Interfaces:**
- Produces: `num(v: number): string` in `src/lib/format.ts` — grouped, 2 dp, no currency suffix (e.g. `2434.4699999999993` → `"2,434.47"`). Task 2 consumes it.

- [ ] **Step 1: Write the failing formatter test**

Append to `src/lib/format.test.ts` (and add `num` to the import from `./format`):

```ts
test("num is grouped, 2 dp, no currency — swallows float noise", () => {
  expect(num(2434.4699999999993)).toBe("2,434.47");
  expect(num(-5)).toBe("-5.00");
  expect(num(0)).toBe("0.00");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `num` is not exported.

- [ ] **Step 3: Export `num` from format.ts**

In `src/lib/format.ts`, after the `grouped` constant:

```ts
/** "1,234.50" — grouped, 2 dp, no currency (chart tooltips, table figures). */
export function num(v: number): string {
  return grouped.format(v);
}
```

- [ ] **Step 4: Run the formatter test to verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing Overview tooltip test**

In `src/views/Overview.test.tsx`, replace the existing Chart mock (lines 5–7) with a capturing mock. `vi.mock` factories are hoisted, so the capture store must use `vi.hoisted`:

```tsx
type CapturedOption = {
  tooltip?: { valueFormatter?: (v: unknown) => string };
};
const captured = vi.hoisted(() => ({ options: [] as unknown[] }));
vi.mock("../components/Chart", () => ({
  default: ({ label, option }: { label: string; option: unknown }) => {
    captured.options.push(option);
    return <div data-testid="chart">{label}</div>;
  },
}));
```

Update the `beforeEach` to also clear captures:

```tsx
beforeEach(() => {
  appStore.getState().reset();
  captured.options.length = 0;
});
```

Append the test:

```tsx
test("every chart tooltip formats values to 2 dp", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      closed_deals: [deal({ profit: 10, commission: 0 })],
    }),
  });
  render(<Overview />);
  expect(captured.options).toHaveLength(3); // equity, monthly, daily
  for (const raw of captured.options) {
    const opt = raw as CapturedOption;
    expect(opt.tooltip?.valueFormatter?.(2434.4699999999993)).toBe("2,434.47");
  }
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/views/Overview.test.tsx`
Expected: the new test FAILS (`valueFormatter` is undefined); the three pre-existing tests still pass.

- [ ] **Step 7: Add valueFormatter to the three Overview charts**

In `src/views/Overview.tsx`, import `num` (extend the existing `../lib/format` import) and add a shared formatter above `CurrencySection`:

```tsx
const tooltipValue = (v: unknown) => num(Number(v));
```

Then change the three tooltip options:

- equity line (line 63): `tooltip: { trigger: "axis", valueFormatter: tooltipValue },`
- monthly bars (line 80): `tooltip: { valueFormatter: tooltipValue },`
- last-30-days bars (line 90): `tooltip: { valueFormatter: tooltipValue },`

- [ ] **Step 8: Run the Overview tests to verify they pass**

Run: `npx vitest run src/views/Overview.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/views/Overview.tsx src/views/Overview.test.tsx
git commit -m "fix: format chart tooltip values to 2 dp"
```

---

### Task 2: Trades table column widths, nowrap, numeric alignment

**Files:**
- Modify: `src/views/Trades.tsx`
- Modify: `src/views/Trades.test.tsx`

**Interfaces:**
- Consumes: `num(v: number): string` from `src/lib/format.ts` (Task 1).
- Produces: nothing consumed by later tasks.

**Why the current layout breaks:** each virtualised row is its own `display: table; table-layout: fixed` element with no cell widths, so all eleven columns get equal width; the ISO timestamp wraps to two lines and the row overflows its 36 px virtual slot. The fix pins explicit widths on header and body cells (so header table and row-tables lay out identically), forbids wrapping, and right-aligns numeric columns.

- [ ] **Step 1: Write the failing alignment/nowrap test**

Append to `src/views/Trades.test.tsx`:

```tsx
test("numeric cells are right-aligned and no cell wraps", () => {
  render(<Trades />);
  const net = screen.getAllByTestId("cell-net")[0]!;
  expect(net.className).toContain("text-right");
  expect(net.className).toContain("whitespace-nowrap");
  const time = screen.getAllByTestId("cell-time")[0]!;
  expect(time.className).toContain("whitespace-nowrap");
  expect(time.className).not.toContain("text-right");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/views/Trades.test.tsx`
Expected: the new test FAILS on `text-right`; the four pre-existing tests still pass.

- [ ] **Step 3: Rework the Closed deals table**

In `src/views/Trades.tsx`:

a) Delete the local `grouped` formatter (lines 17–20) and import the shared one instead:

```ts
import { num } from "../lib/format";
```

Replace every `grouped.format(` with `num(` (Closed deals, Open positions, Cash flows).

b) Add a numeric-column set above `ClosedDeals`:

```ts
// Columns holding figures: right-aligned, ledger style.
const NUMERIC_COLS = new Set([
  "volume", "price", "profit", "swap", "commission", "fee", "net",
]);
```

c) Give every column an explicit `size` (px) in the `columns` memo:

```ts
col.accessor("time", { header: "Time", size: 185, cell: (c) => iso(c.getValue()) }),
col.accessor("account", {
  header: "Account",
  size: 130,
  cell: (c) => labels.get(c.getValue()) ?? String(c.getValue()),
}),
col.accessor("symbol", { header: "Symbol", size: 95 }),
col.accessor("magic", { header: "Magic", size: 80 }),
col.accessor("volume", { header: "Volume", size: 80 }),
col.accessor("price", { header: "Price", size: 95 }),
col.accessor("profit", { header: "Profit", size: 95, cell: (c) => num(c.getValue()) }),
col.accessor("swap", { header: "Swap", size: 80, cell: (c) => num(c.getValue()) }),
col.accessor("commission", { header: "Commission", size: 110, cell: (c) => num(c.getValue()) }),
col.accessor("fee", { header: "Fee", size: 75, cell: (c) => num(c.getValue()) }),
col.accessor((d) => dealNet(d), {
  id: "net",
  header: "Net",
  size: 95,
  cell: (c) => num(c.getValue()),
}),
```

d) Pin the layout in the JSX. Outer `<table>`: add `table-fixed` and a min-width so columns never shrink below their size (the wrapper already scrolls):

```tsx
<table
  className="w-full table-fixed font-mono text-sm tabular-nums"
  style={{ minWidth: table.getTotalSize() }}
>
```

Header cell — width from the column def, alignment by column id:

```tsx
<th
  key={h.id}
  style={{ width: h.getSize() }}
  className={`border-b border-border p-2 text-xs tracking-wide text-muted uppercase ${
    NUMERIC_COLS.has(h.column.id) ? "text-right" : "text-left"
  }`}
>
```

Body cell — same width and alignment, plus nowrap:

```tsx
<td
  key={cell.id}
  style={{ width: cell.column.getSize() }}
  className={`p-2 whitespace-nowrap ${
    NUMERIC_COLS.has(cell.column.id) ? "text-right" : "text-left"
  }`}
  data-testid={`cell-${cell.column.id}`}
>
```

The row `<tr>` keeps its existing `display: table; tableLayout: "fixed"` style — with per-cell widths now set, every row lays out identically to the header.

- [ ] **Step 4: Align the Open positions and Cash flows tables to match**

Same file. Convert each header list to `[label, numeric]` pairs and mirror the classes:

Open positions header:

```tsx
{([
  ["Opened", false], ["Account", false], ["Symbol", false], ["Magic", true],
  ["Volume", true], ["Open", true], ["Current", true], ["SL", true],
  ["TP", true], ["Profit", true], ["Swap", true],
] as const).map(([h, numeric]) => (
  <th
    key={h}
    className={`border-b border-border p-2 text-xs tracking-wide text-muted uppercase ${numeric ? "text-right" : "text-left"}`}
  >
    {h}
  </th>
))}
```

Open positions body cells: every `<td className="p-2">` becomes `p-2 whitespace-nowrap`, and the Magic, Volume, Open, Current, SL, TP, Profit, Swap cells additionally get `text-right`.

Cash flows: same treatment with `[["Time", false], ["Account", false], ["Type", true], ["Amount", true], ["Comment", false]]`; the Type and Amount body cells get `text-right`, all body cells get `whitespace-nowrap`.

- [ ] **Step 5: Run the Trades tests to verify they pass**

Run: `npx vitest run src/views/Trades.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Eyeball the real table**

Run: `npm run dev`, load a snapshot (or run `npm run e2e` later and rely on Task 4). Check in the browser: single-line rows, aligned header/body columns, right-aligned figures, horizontal scroll on a narrow window rather than wrapping.

- [ ] **Step 7: Commit**

```bash
git add src/views/Trades.tsx src/views/Trades.test.tsx
git commit -m "fix: pin trades table column widths and right-align figures"
```

---

### Task 3: Calendar weekly totals column

**Files:**
- Modify: `src/views/CalendarView.tsx`
- Modify: `src/views/CalendarView.test.tsx`
- Modify: `README.md` (Views → Calendar bullet)

**Interfaces:**
- Consumes: existing `bucketByDayUTC`, `signedMoney`, `buildMonthCells`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing week-total test**

Append to `src/views/CalendarView.test.tsx`:

```tsx
test("week column totals net, trades, and traded days for its row", () => {
  const thu = Date.UTC(2025, 5, 12, 10) / 1000; // Thu 2025-06-12
  const fri = Date.UTC(2025, 5, 13, 10) / 1000; // Fri 2025-06-13
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      closed_deals: [
        deal({ time: thu, profit: 10, commission: 0 }),
        deal({ time: thu, profit: -4, commission: 0 }),
        deal({ time: fri, profit: 5, commission: 0 }),
      ],
    }),
  });
  render(<CalendarView />);
  // June 2025 starts on a Sunday: week 1 is Jun 1 alone, week 3 is Jun 9-15.
  const week = screen.getByRole("gridcell", { name: /week 3 total/i });
  expect(within(week).getByText("+11.00")).toBeInTheDocument();
  expect(within(week).getByText("3 trades · 2 days")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Week" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/views/CalendarView.test.tsx`
Expected: the new test FAILS (no such gridcell); the three pre-existing tests still pass.

- [ ] **Step 3: Implement the week column**

In `src/views/CalendarView.tsx`:

a) Extend the react import: `import { Fragment, useMemo, useState, type CSSProperties } from "react";`

b) Add a `WeekCell` component after `MonthGrid`'s helpers (module level, above `MonthGrid`):

```tsx
function WeekCell({
  index,
  week,
  days,
}: {
  index: number;
  week: (string | null)[];
  days: Map<string, Bucket>;
}) {
  let net = 0;
  let trades = 0;
  let tradedDays = 0;
  for (const key of week) {
    const b = key ? days.get(key) : undefined;
    if (b) {
      net += b.net;
      trades += b.trades;
      tradedDays++;
    }
  }
  if (tradedDays === 0) return <div role="gridcell" aria-hidden className="min-h-16" />;
  return (
    <div
      role="gridcell"
      aria-label={`Week ${index + 1} total`}
      className="min-h-16 rounded-md border border-border bg-surface-2 p-1.5 font-mono text-sm tabular-nums"
    >
      <div className="text-[0.7rem] tracking-wide text-muted uppercase">
        W{index + 1}
      </div>
      <div className={`mt-0.5 font-semibold ${net >= 0 ? "text-pos" : "text-neg"}`}>
        {signedMoney(net, "").trim()}
      </div>
      <div className="text-[0.7rem] text-muted">
        {trades} trades · {tradedDays} {tradedDays === 1 ? "day" : "days"}
      </div>
    </div>
  );
}
```

(Quieter than day cells by design: raised surface and a tone-coloured figure, no heat background — a summary, not another day. Totals are month-scoped because `cells` only contains the displayed month's days.)

c) In `MonthGrid`, group the cells into weeks (after the `cells` memo):

```tsx
const weeks = useMemo(() => {
  const out: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}, [cells]);
```

d) Rework the grid JSX: eight columns, a "Week" header after the weekday headers, and per-week rendering. The day-cell markup is unchanged — it moves inside the week loop with `key`/`i` coming from the inner map:

```tsx
<div
  role="grid"
  aria-label={`${MONTHS[month0]} ${year}`}
  className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1fr)] gap-1.5"
>
  {WEEKDAYS.map((w) => (
    <div
      key={w}
      role="columnheader"
      className="pb-1 text-center text-xs tracking-wide text-muted uppercase"
    >
      {w}
    </div>
  ))}
  <div
    role="columnheader"
    className="pb-1 text-center text-xs tracking-wide text-muted uppercase"
  >
    Week
  </div>
  {weeks.map((week, w) => (
    <Fragment key={w}>
      {week.map((key, i) =>
        key === null ? (
          <div key={i} role="gridcell" aria-hidden className="min-h-16" />
        ) : (
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
            <div className="text-muted">{Number(key.slice(8))}</div>
            {days.get(key) && (
              <>
                <div className="mt-0.5 font-semibold text-text">
                  {signedMoney(days.get(key)!.net, "").trim()}
                </div>
                <div className="text-[0.7rem] text-muted">
                  {days.get(key)!.trades} trades
                </div>
              </>
            )}
          </div>
        ),
      )}
      <WeekCell index={w} week={week} days={days} />
    </Fragment>
  ))}
</div>
```

(The day-cell JSX is unchanged from the current file; only its position moves inside the week loop.)

- [ ] **Step 4: Run the calendar tests to verify they pass**

Run: `npx vitest run src/views/CalendarView.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Update the README Calendar bullet**

In `README.md` (Views section), change the Calendar bullet to:

```markdown
- **Calendar** — a month grid with one cell per trading day, coloured by
  net P&L sign and shaded by magnitude, plus a week-total column and a
  running month total.
```

- [ ] **Step 6: Commit**

```bash
git add src/views/CalendarView.tsx src/views/CalendarView.test.tsx README.md
git commit -m "feat: add week-total column to the calendar"
```

---

### Task 4: Full verification and e2e coverage

**Files:**
- Modify: `e2e/app.spec.ts:18-19`

**Interfaces:**
- Consumes: the Week columnheader from Task 3.

- [ ] **Step 1: Extend the e2e calendar assertion**

In `e2e/app.spec.ts`, after the existing Calendar navigation (line 19 `await expect(page.getByRole("grid").first()).toBeVisible();`), add:

```ts
await expect(
  page.getByRole("columnheader", { name: "Week" }).first(),
).toBeVisible();
```

- [ ] **Step 2: Run the full check suite**

Run: `npm test && npm run lint && npm run build`
Expected: all unit tests pass, no lint errors, build succeeds (build includes `tsc --noEmit`).

- [ ] **Step 3: Run the e2e suite**

Run: `npm run e2e`
Expected: all Playwright tests pass, including the new Week assertion, against the real worker and fixture.

- [ ] **Step 4: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test: assert the calendar week column end to end"
```
