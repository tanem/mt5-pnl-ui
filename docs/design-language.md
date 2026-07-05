# Design language

The token system behind mt5-pnl-ui and the reasoning for each choice. The tokens
live in `src/index.css` (CSS custom properties, mapped to Tailwind utilities via
`@theme inline`) and `src/lib/chartTheme.ts` (the chart palette). This document is
the source of intent; the CSS is the source of truth.

## Brief

A self-hosted, browser-side reader of encrypted MetaTrader 5 trading history. Its
users are algorithmic traders reviewing realised P&L, drawdown, and per-strategy
performance — a tool opened weekly and kept for years. The data is the hero:
legibility beats decoration, and every figure must be scannable and comparable at
a glance. Dark is the default theme; light is a designed counterpart, not an
inversion.

## Palette

Semantic tokens are defined on `:root` for dark (the default) and overridden under
`@media (prefers-color-scheme: light)`, so a single set of utilities re-themes at
runtime.

### Named roles

| Role | Token | Dark | Light |
|------|-------|------|-------|
| Page plane | `--bg` | `#0f1216` | `#f5f3ee` |
| Surface (cards, tiles, tables) | `--surface` | `#171b21` | `#ffffff` |
| Raised surface (header, hover) | `--surface-2` | `#1e232b` | `#ece9e2` |
| Hairline border | `--border` | `#2a313b` | `#ddd8cd` |
| Primary ink | `--text` | `#e6e9ee` | `#1b1e23` |
| Secondary ink (labels) | `--muted` | `#97a0ac` | `#5b616b` |
| Accent (interactive, equity line, focus) | `--accent` | `#5b9bf0` | `#2f6bcc` |

The palette defines seven named roles; the brief anticipated 4–6, but raised
surface (`--surface-2`) and hairline border (`--border`) proved load-bearing in the
instrument-panel layout concept.

### Semantic P&L pair (reserved for meaning, never decoration)

| Role | Token | Dark | Light |
|------|-------|------|-------|
| Profit | `--pos` | `#35c988` | `#0f7a45` |
| Loss | `--neg` | `#f36a72` | `#c0303c` |

Green and red carry reserved meanings: the sign of a monetary figure, and (for
loss-red) error state. They never appear as chrome, branding, or emphasis. The
interactive accent is deliberately blue — a third hue distinct from both P&L
colours — so "this is a control / this is the cumulative line" can never be misread
as "this is a gain / a loss".

### WCAG AA contrast (checked, both themes)

Contrast ratios of ink and semantic colours against the surface they sit on. AA
requires 4.5:1 for normal text; all foreground text tokens clear it in both themes.

| Foreground | Dark on `--surface` | Light on `--surface` |
|------------|---------------------|----------------------|
| `--text` | 14.2 | 16.7 |
| `--muted` | 6.5 | 6.2 |
| `--accent` | 6.1 | 5.1 |
| `--pos` | 8.1 | 5.4 |
| `--neg` | 5.9 | 5.6 |

(Contrast script and figures reproduced during development; re-run against the
surface a colour actually renders on if these values change.)

### Chart palette (`src/lib/chartTheme.ts`)

Charts render to an ECharts canvas that is not re-themed at runtime, so they share
one static palette validated to read on both the dark (`#171b21`) and light
(`#ffffff`) chart surface:

- `POS #2bad70`, `NEG #e05561` — profit / loss bars.
- `LINE #4785e0` — cumulative / equity line (the accent family).
- `AXIS #898781`, `GRID rgba(137,135,129,0.18)` — theme-invariant muted furniture.

The profit/loss pair is the worst-case colour-vision-deficiency adjacency
(red↔green). Per the dataviz method, its validator reports the pair in the 8–12 ΔE
floor band, which is permitted **only with a secondary encoding** — satisfied here
because sign is also carried by position (bars sit above or below the zero
baseline) and by the signed figure printed alongside every value. Colour is never
the sole channel for sign.

## Typography

Three roles, all from system stacks or self-hosted files — the app's Content
Security Policy forbids remote fonts.

- **Display** — the mono wordmark and the currency section headings, set in
  `--font-mono` with wide tracking and small caps-like uppercasing. Used with
  restraint: the masthead wordmark and one label per section, nowhere else. The
  wordmark is literally a command name in the `mt5-pnl-*` CLI family, so a
  monospace treatment is honest to the subject rather than ornamental.
- **Body** — `--font-sans` (system UI sans) for navigation, prose, form labels,
  and controls.
- **Data** — `--font-mono` with `tabular-nums` for every figure: stat tiles,
  every table cell, calendar day totals, and the month total. Monospaced tabular
  numerals make columns of money align digit-for-digit, the way a broker statement
  does, so a trader compares magnitudes by eye without reading each number.

## Layout and signature

**Layout concept — a calm instrument panel.** A slim sticky masthead (wordmark,
tab navigation, file provenance, Close) sits above a secondary filter rail; content
flows in a single centred column (`max-w-6xl`) with generous vertical rhythm. The
active tab is marked by a 2px accent underline — the one place the accent touches
chrome, because "where am I" is a legibility question. Everything around the data
is quiet: hairline borders, muted labels, no glow, no gradient fills.

**Signature element — the P&L heat-calendar.** The calendar's day cells are the one
memorable device. Each cell's background intensity scales with the day's magnitude
relative to that month's peak (`--heat`, 0..1, driving the alpha of the profit or
loss colour), so the eye ranks winning and losing days by weight before reading a
single figure — exactly the scan a trader makes ("which days moved the account?").
The same tone language echoes, quietly, as a left edge on stat tiles, tying tiles,
calendar, and charts into one visual system. The boldness is spent here, where it
serves the reading; it is spent nowhere else.

## Anti-default check

The generic AI trading-dashboard look is **near-black (`#0a0a0a`) with a single
acid-green or cyan glow**, neon P&L numbers, and glassy cards. Every token deviates
from it for a reason grounded in this subject:

- **Ground is slate ink `#0f1216`, not `#0a0a0a`.** A tool read for hours over
  years should not vibrate. A slightly blue-shifted dark grey softens the
  black-vs-glow contrast that causes eye strain, and gives the semantic colours a
  calm field to sit on.
- **No glow, no neon.** Acid green would collide head-on with the single most
  important reserved colour in the app — profit green. Emphasis by glow would
  compete with the data. Emphasis here is done with weight, alignment, and a
  hairline, never with light.
- **Accent is blue, not green.** The default look uses its accent everywhere,
  including where a gain/loss reading lives. Reserving green/red strictly for sign
  forces the interactive colour to be a third hue; blue also reads as
  "information, not outcome" for the cumulative equity line.
- **Light theme is warm paper `#f5f3ee`, not white and not an inverted dark.** It
  evokes the printed statement the data descends from and is easier on the eye for
  a long review; it was designed and contrast-checked in its own right.
- **Type is a mono ledger, not a big-number-with-gradient hero.** The template
  answer is one giant figure with a gradient. This subject has dozens of figures
  that must be *compared*, so the treatment that serves it is column alignment
  (tabular monospace) across every tile and table, not one number made large.

## Accessibility floor

- `:focus-visible` draws a 2px accent outline with offset on every interactive
  element.
- `@media (prefers-reduced-motion: reduce)` collapses all transitions and
  animations.
- `data-tone` drives tile and calendar-cell colour from the same tokens, so the
  P&L language stays consistent and re-themes with everything else.
- Layout is responsive to ≤ 400px: tiles reflow to two columns, tables scroll
  horizontally within a bordered container rather than forcing the page to scroll.
