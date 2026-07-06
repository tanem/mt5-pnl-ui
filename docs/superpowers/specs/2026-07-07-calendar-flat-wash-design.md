# Calendar day-cell flat wash — design

Date: 2026-07-07. Status: approved.

The calendar's traded day cells are meant to read green or red at a
glance. Today they don't: only the tinted border renders, so sign is
carried by a hairline and the signed figure alone. This change gives
every traded day a flat background wash in the profit or loss colour
and removes the magnitude-scaled "heat" treatment from the design.

## Background

Two findings motivate this, one a bug and one a design decision.

**The heat background never rendered.** `src/index.css` defines
magnitude-scaled backgrounds for `.day-cell[data-tone]` (alpha
`0.1 + 0.5 × --heat`, where `--heat` is the day's |net| relative to
the month's peak). Those rules live in `@layer base`, but the day cell
also carries Tailwind's `bg-surface` utility, and the `utilities`
layer wins over `base` by cascade-layer order regardless of
specificity. Verified in a real render: a traded cell computes to
`rgb(255, 255, 255)` (the surface) as shipped, and to the intended
tint the moment the same rules are applied outside the layer. Only the
`border-color` declarations survive, which is the rendering users see.

**Magnitude scaling is not wanted.** With heat restored, the month's
largest losing day renders darkest — the calendar would rank bad days
by weight and give the worst one the most visual force. For a review
tool this amplifies rather than informs: sign belongs at a glance,
magnitude belongs to the figures. The day and week cells already print
signed amounts, and week/month totals and the Overview carry the
weight comparison. So the wash is deliberately flat: every traded day
gets the same tint strength regardless of size.

## Change

Traded day cells get a flat background wash: the semantic P&L colour
at 12% opacity over the surface, plus the existing tinted border.
Untraded days are unchanged. The `--heat` mechanism is deleted.

The 12% strength was chosen from rendered variants (12% and 20%
flat washes compared against the current rendering, both themes):
clearly green/red at arm's length, quiet enough to sit within the
existing palette's restraint.

### `src/index.css`

- `.day-cell` gains `background: var(--surface)` as its resting
  background, replacing the `bg-surface` utility in the JSX. With the
  utility gone, the `data-tone` rules win within `@layer base` by
  specificity and source order — no cascade-layer conflict remains.
- `.day-cell[data-tone="pos"]` background becomes
  `rgb(var(--pos-rgb) / 0.12)`; `neg` likewise with `--neg-rgb`.
  Border-color rules are unchanged.
- The comment block above these rules is rewritten: it currently
  documents the heat scale; it should document the flat wash and the
  deliberate choice not to scale by magnitude.

### `src/views/CalendarView.tsx`

- Remove `bg-surface` from the day-cell `className`.
- Delete the `--heat` inline `style` and the `peak` computation in
  `MonthGrid` (its only consumer).
- Drop the `CSSProperties` import, which becomes unused.
- `data-tone` is unchanged — it drives both wash and border.

### Regression guard (`e2e/app.spec.ts`)

The original bug shipped because no test asserts a computed style —
unit tests run in jsdom, which never loads the Tailwind-built CSS.
Extend the calendar step of the existing dashboard journey to assert
computed `background-color` on one `data-tone="pos"` and one
`data-tone="neg"` day cell: `rgba(15, 122, 69, 0.12)` and
`rgba(192, 48, 60, 0.12)` (the light-theme `--pos-rgb`/`--neg-rgb`;
Playwright's default colour scheme is light). This is the assertion
that would have caught the cascade-layer regression.

### `docs/design-language.md`

Rewrite the **Signature element** paragraph (currently "the P&L
heat-calendar"). The calendar tone-wash remains the signature, but
flat by design: sign is instant, magnitude is left to the signed
figures and the week/month totals, so a large losing day carries no
more visual force than a small one. Keep the point that `data-tone`
ties tiles and calendar cells to the same tokens; remove the `--heat`
mechanics from the paragraph.

## Not in scope

- Stat tiles, charts, tokens, and all other views are untouched.
- `docs/screenshot.png` needs no refresh: it captures the Overview
  view only, which this change does not affect.
- No new tint for the week-total column; it keeps its `text-pos`/
  `text-neg` figures on the raised surface.

## Verification

- `npm test`, `npm run e2e` (including the new computed-style
  assertions), `npm run lint`, `npm run typecheck`.
- `npm run visual` and inspect `visual-review/calendar-light.png` and
  `calendar-dark.png`: traded days show the flat wash in both themes;
  untraded days remain plain surface.
