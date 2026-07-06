# Dashboard polish: chart tooltips, trades table layout, calendar weekly totals

Date: 2026-07-06
Status: approved

Three small, independent UI changes. Semantics are unchanged throughout —
no new figures beyond a weekly aggregation of the existing UTC day buckets,
and nothing sums across currencies.

## 1. Chart tooltip number formatting

**Problem.** Chart tooltips render raw floats. The cumulative equity curve
is a running sum, so binary float noise surfaces in the tooltip (e.g.
`2,434.4699999999993`).

**Design.** Add ECharts' `valueFormatter` to the tooltip of all three
Overview charts (cumulative line, monthly bars, last-30-days bars), using
the shared 2-dp grouped formatter from `src/lib/format.ts`. Display-only:
the series data keeps full precision, so the plotted curve is unchanged.

## 2. Trades table layout

**Problem.** In the Closed deals tab, each virtualised row is its own
`display: table; table-layout: fixed` element with no column widths, so
all eleven columns get equal width. The ISO timestamp cannot fit in one
eleventh of the table, wraps to two lines, and the row overflows its
fixed-height virtual slot, overlapping neighbouring rows. Header widths
are also not tied to body widths.

**Design.**

- Give each column an explicit pixel width via TanStack Table's `size`,
  applied to both header and body cells, so the header table and each
  row-table lay out identically.
- `whitespace-nowrap` on cells; rows stay one line tall, matching the
  virtualiser's fixed row height.
- Right-align numeric columns (volume, price, profit, swap, commission,
  fee, net); keep time, account, symbol left-aligned. Headers align with
  their column's content.
- Apply the same alignment treatment to the plain (non-virtualised) Open
  positions and Cash flows tables for consistency.

## 3. Calendar weekly totals

**Problem.** The calendar shows per-day and per-month P&L but nothing in
between; a per-week figure is a common way to read a trading month.

**Design.**

- Extend the calendar grid from seven to eight columns; the eighth column
  is a week-summary cell at the end of each row, headed "Week".
- Each week cell shows the signed net for the week, the trade count, and
  the number of traded days, from the existing UTC day buckets
  (`bucketByDayUTC`) — no new derivation semantics.
- Quieter styling than day cells: tone-coloured figure (pos/neg), no heat
  background, so it reads as a summary rather than another day.
- Totals are month-scoped: the first and last week of a month sum only
  the days shown, consistent with the existing "Month total" line. Weeks
  are Monday-start, UTC, matching the grid.
- Weeks with no trading days render an empty cell.

## Testing

- Unit (Vitest): tooltip `valueFormatter` output at 2 dp; week totals
  (sums, trade counts, traded-day counts, month-scoping at month
  boundaries, empty weeks); table cells carry the expected alignment and
  nowrap classes.
- e2e (Playwright): existing suites must pass; extend the calendar spec
  to assert a week total from the fixture if straightforward.
- `docs/screenshot.png` captures the Overview view only, which changes
  only in tooltip hover state; no regeneration needed unless the capture
  differs.
