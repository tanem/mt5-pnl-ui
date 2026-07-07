# Account Returns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lifetime account-returns band to the Overview — deposited, withdrawn, floating, profit, percentage gain per account and per currency group — per the approved spec at `docs/superpowers/specs/2026-07-07-account-returns-design.md`.

**Architecture:** A new pure derive module (`src/lib/derive/returns.ts`) computes identity-based returns from `AccountSnapshot.balance`/`equity` and `cash_flows`; a new selector applies only the account filter; the Overview's per-currency sections become account-driven so the band survives date/symbol/magic filtering, and a new `ReturnsBand` component renders it.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest + Testing Library (jsdom, worker mocked), Playwright e2e against a real encrypted fixture.

## Global Constraints

- British/Commonwealth English in comments and docs; plain and factual, no hyperbole (CLAUDE.md).
- Never sum across currency groups — one section per currency, no combined totals ever.
- Returns figures respect the **account filter only**, never date/symbol/magic. Lifetime semantics are defined by this repo's spec, not mt5-pnl-cli.
- `filters.accounts === null` means "all accounts"; `[]` means "match nothing".
- Semantic pos/neg colour only via `StatTile`'s `tone` prop; nothing new in `src/lib/chartTheme.ts`; no hard-coded hex values.
- Committed artifacts must not mention any personal financial situation; examples stay generic.
- No dependency changes (Renovate-managed).
- README.md and CLAUDE.md are updated in the same change as the behaviour they describe (Task 6).
- Every commit message ends with the trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Signed-percent formatter

**Files:**
- Modify: `src/lib/format.ts` (append after `pct`, line 23)
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `signedPct(v: number | null): string` — `0.35 → "+35.0%"`, `-0.031 → "-3.1%"`, `0 → "0.0%"`, `null → "n/a"`. Used by Tasks 3–5.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/format.test.ts` (it already imports from `./format`; extend the import list with `signedPct`):

```ts
test("signedPct formats signed percentages from fractions", () => {
  expect(signedPct(0.35)).toBe("+35.0%");
  expect(signedPct(-0.031)).toBe("-3.1%");
  expect(signedPct(1.5)).toBe("+150.0%");
  expect(signedPct(0)).toBe("0.0%");
  expect(signedPct(null)).toBe("n/a");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — `signedPct` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/format.ts`:

```ts
/** 0.35 → "+35.0%" — signed, may exceed 100% (account gain); null → "n/a". */
export function signedPct(v: number | null): string {
  if (v === null) return "n/a";
  const s = `${(v * 100).toFixed(1)}%`;
  return v > 0 ? `+${s}` : s;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: add a signed-percent formatter for account gain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Returns derive module

**Files:**
- Create: `src/lib/derive/returns.ts`
- Test: `src/lib/derive/returns.test.ts`
- Modify: `tests/helpers/fixture.ts` (add a `flow` helper after `deal`, line 32)

**Interfaces:**
- Consumes: `dealNet` from `src/lib/derive/stats.ts`; `AccountSnapshot`, `CashFlow`, `ClosedDeal` from `src/lib/snapshot/types.ts`; `deal`/`account` helpers from `tests/helpers/fixture.ts`.
- Produces (used by Tasks 3–4):
  - `BALANCE_DEAL_TYPE = 2`
  - `interface AccountReturns { login: number; label: string; currency: string; deposits: number; withdrawals: number; adjustments: number; balance: number; floating: number; profit: number; gainPct: number | null; reconciles: boolean }`
  - `interface ReturnsTotals { deposits: number; withdrawals: number; adjustments: number; floating: number; profit: number; gainPct: number | null }`
  - `interface ReturnsGroup { accounts: AccountReturns[]; totals: ReturnsTotals }`
  - `computeAccountReturns(account: AccountSnapshot, flows: CashFlow[], deals: ClosedDeal[]): AccountReturns`
  - `groupReturnsByCurrency(accounts: AccountSnapshot[], flows: CashFlow[], deals: ClosedDeal[], accountFilter: number[] | null): Map<string, ReturnsGroup>`
  - `flow(overrides?: Partial<ClosedDeal>): ClosedDeal` in `tests/helpers/fixture.ts`

- [ ] **Step 1: Add the cash-flow fixture helper**

Append to `tests/helpers/fixture.ts` after `deal` (note `commission: 0` — `deal`'s default `-0.5` would silently distort flow amounts):

```ts
/** Balance-family cash-flow record — MT5 zeroes the trade fields. */
export function flow(overrides: Partial<ClosedDeal> = {}): ClosedDeal {
  return deal({
    type: 2,
    entry: 0,
    magic: 0,
    volume: 0,
    price: 0,
    profit: 1000,
    commission: 0,
    symbol: "",
    ...overrides,
  });
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/derive/returns.test.ts`:

```ts
import { expect, test } from "vitest";
import { computeAccountReturns, groupReturnsByCurrency } from "./returns";
import { account, deal, flow } from "../../../tests/helpers/fixture";

test("classifies balance deals by sign and derives identity-based profit", () => {
  // The spec's worked example: deposited 10,000; withdrawn 4,000;
  // balance 9,000; floating 500 → profit 3,500 → gain 35%.
  const r = computeAccountReturns(
    account({ balance: 9000, equity: 9500 }),
    [flow({ profit: 10000 }), flow({ profit: -4000 })],
    [],
  );
  expect(r.deposits).toBe(10000);
  expect(r.withdrawals).toBe(4000);
  expect(r.floating).toBe(500);
  expect(r.profit).toBe(3500);
  expect(r.gainPct).toBeCloseTo(0.35);
});

test("non-balance types are adjustments, never deposits or withdrawals", () => {
  const r = computeAccountReturns(
    account({ balance: 1050, equity: 1050 }),
    [flow({ profit: 1000 }), flow({ type: 6, profit: 50 })], // bonus
    [],
  );
  expect(r.deposits).toBe(1000);
  expect(r.adjustments).toBe(50);
  expect(r.profit).toBe(50); // the bonus is gain the holder did not deposit
});

test("gainPct is null when there are no deposits", () => {
  const r = computeAccountReturns(account(), [], []);
  expect(r.gainPct).toBeNull();
});

test("reconciliation holds at the 0.01 tolerance and fails beyond it", () => {
  const flows = [flow({ profit: 10000 }), flow({ profit: -4000 })];
  const deals = [deal({ profit: 3000, commission: 0 })];
  // deposits − withdrawals + adjustments + Σ dealNet = 9,000
  expect(
    computeAccountReturns(account({ balance: 9000.01, equity: 9000.01 }), flows, deals)
      .reconciles,
  ).toBe(true);
  expect(
    computeAccountReturns(account({ balance: 9000.02, equity: 9000.02 }), flows, deals)
      .reconciles,
  ).toBe(false);
});

test("ignores flows and deals belonging to other accounts", () => {
  const r = computeAccountReturns(
    account({ login: 111, balance: 1000, equity: 1000 }),
    [flow({ account: 111, profit: 1000 }), flow({ account: 222, profit: 5000 })],
    [deal({ account: 222, profit: 99 })],
  );
  expect(r.deposits).toBe(1000);
  expect(r.reconciles).toBe(true);
});

test("groups by currency with summed totals and a group gain", () => {
  const accounts = [
    account({ login: 111, currency: "USD", balance: 1100, equity: 1100 }),
    account({ login: 222, currency: "USD", balance: 900, equity: 900 }),
    account({ login: 333, currency: "EUR", balance: 500, equity: 500 }),
  ];
  const flows = [
    flow({ account: 111, profit: 1000 }),
    flow({ account: 222, profit: 1000 }),
    flow({ account: 333, profit: 400 }),
  ];
  const groups = groupReturnsByCurrency(accounts, flows, [], null);
  expect([...groups.keys()].sort()).toEqual(["EUR", "USD"]);
  const usd = groups.get("USD")!;
  expect(usd.accounts).toHaveLength(2);
  expect(usd.totals.deposits).toBe(2000);
  expect(usd.totals.profit).toBe(0); // +100 and −100
  expect(usd.totals.gainPct).toBe(0);
  expect(groups.get("EUR")!.totals.gainPct).toBeCloseTo(0.25);
});

test("account filter: null means all, [] means none, list selects", () => {
  const accounts = [
    account({ login: 111, currency: "USD" }),
    account({ login: 222, currency: "EUR" }),
  ];
  expect(groupReturnsByCurrency(accounts, [], [], null).size).toBe(2);
  expect(groupReturnsByCurrency(accounts, [], [], []).size).toBe(0);
  const only = groupReturnsByCurrency(accounts, [], [], [222]);
  expect([...only.keys()]).toEqual(["EUR"]);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/derive/returns.test.ts`
Expected: FAIL — `./returns` does not exist.

- [ ] **Step 4: Write the implementation**

Create `src/lib/derive/returns.ts`:

```ts
import type { AccountSnapshot, CashFlow, ClosedDeal } from "../snapshot/types";
import { dealNet } from "./stats";

/** MT5's balance deal type — deposits and withdrawals, sign-distinguished. */
export const BALANCE_DEAL_TYPE = 2;

/** Reconciliation tolerance, in account currency (float rounding headroom). */
const RECONCILE_TOLERANCE = 0.01;

/**
 * Lifetime money-in/out figures for one account. Semantics are this repo's
 * own (the account returns spec), not mirrored from mt5-pnl-cli. Profit is
 * identity-based — withdrawals + balance + floating − deposits — so a
 * truncated deal history cannot corrupt it. Adjustments (credits, charges,
 * corrections, bonuses, …) already sit inside `balance`, and therefore
 * inside `profit`; they are reported informationally, never re-added.
 */
export interface AccountReturns {
  login: number;
  label: string;
  currency: string;
  deposits: number;
  withdrawals: number;
  adjustments: number;
  balance: number;
  floating: number;
  profit: number;
  /** profit ÷ deposits; null when nothing was deposited. */
  gainPct: number | null;
  /** deposits − withdrawals + adjustments + Σ dealNet ≈ balance. */
  reconciles: boolean;
}

export interface ReturnsTotals {
  deposits: number;
  withdrawals: number;
  adjustments: number;
  floating: number;
  profit: number;
  gainPct: number | null;
}

export interface ReturnsGroup {
  accounts: AccountReturns[];
  totals: ReturnsTotals;
}

export function computeAccountReturns(
  account: AccountSnapshot,
  flows: CashFlow[],
  deals: ClosedDeal[],
): AccountReturns {
  let deposits = 0;
  let withdrawals = 0;
  let adjustments = 0;
  for (const f of flows) {
    if (f.account !== account.login) continue;
    const net = dealNet(f);
    if (f.type !== BALANCE_DEAL_TYPE) adjustments += net;
    else if (net > 0) deposits += net;
    else withdrawals += -net;
  }

  let dealsNet = 0;
  for (const d of deals) {
    if (d.account === account.login) dealsNet += dealNet(d);
  }

  const floating = account.equity - account.balance;
  const profit = withdrawals + account.balance + floating - deposits;
  return {
    login: account.login,
    label: account.label,
    currency: account.currency,
    deposits,
    withdrawals,
    adjustments,
    balance: account.balance,
    floating,
    profit,
    gainPct: deposits > 0 ? profit / deposits : null,
    reconciles:
      Math.abs(deposits - withdrawals + adjustments + dealsNet - account.balance) <=
      RECONCILE_TOLERANCE,
  };
}

/**
 * Returns per account currency, for the accounts in scope. Aggregates only
 * within a group — never across currencies (the mixed-currency guard).
 */
export function groupReturnsByCurrency(
  accounts: AccountSnapshot[],
  flows: CashFlow[],
  deals: ClosedDeal[],
  accountFilter: number[] | null,
): Map<string, ReturnsGroup> {
  const scope =
    accountFilter === null
      ? accounts
      : accounts.filter((a) => accountFilter.includes(a.login));

  const out = new Map<string, ReturnsGroup>();
  for (const a of scope) {
    const r = computeAccountReturns(a, flows, deals);
    let group = out.get(a.currency);
    if (!group) {
      group = {
        accounts: [],
        totals: {
          deposits: 0,
          withdrawals: 0,
          adjustments: 0,
          floating: 0,
          profit: 0,
          gainPct: null,
        },
      };
      out.set(a.currency, group);
    }
    group.accounts.push(r);
    group.totals.deposits += r.deposits;
    group.totals.withdrawals += r.withdrawals;
    group.totals.adjustments += r.adjustments;
    group.totals.floating += r.floating;
    group.totals.profit += r.profit;
  }
  for (const group of out.values()) {
    group.totals.gainPct =
      group.totals.deposits > 0 ? group.totals.profit / group.totals.deposits : null;
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/derive/returns.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/derive/returns.ts src/lib/derive/returns.test.ts tests/helpers/fixture.ts
git commit -m "feat: derive lifetime account returns from cash flows and balances

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: ReturnsBand component

**Files:**
- Create: `src/components/ReturnsBand.tsx`
- Test: `src/components/ReturnsBand.test.tsx`
- Modify: `src/components/StatTile.tsx` (export `tone`), `src/views/Overview.tsx:12-14` (delete the local `tone`, import it)

**Interfaces:**
- Consumes: `StatTile` + new `tone` export; `money`, `num`, `signedMoney`, `signedPct` from `src/lib/format.ts`; `ReturnsGroup`, `computeAccountReturns` (tests) from Task 2.
- Produces: `default ReturnsBand({ currency, group, filtersActive }: { currency: string; group: ReturnsGroup; filtersActive: boolean })` — a `<section aria-label="{currency} account returns">`. Used by Task 4.
- Produces: `tone(v: number): "pos" | "neg" | "neutral"` exported from `src/components/StatTile.tsx`.

- [ ] **Step 1: Move `tone` into StatTile**

Append to `src/components/StatTile.tsx`:

```ts
/** Sign → tile tone: positive pos, negative neg, zero neutral. */
export function tone(v: number): "pos" | "neg" | "neutral" {
  return v > 0 ? "pos" : v < 0 ? "neg" : "neutral";
}
```

In `src/views/Overview.tsx`, delete the local `tone` function (lines 12–14) and change the StatTile import to:

```ts
import StatTile, { tone } from "../components/StatTile";
```

Run: `npx vitest run src/views/Overview.test.tsx` — Expected: PASS (behaviour unchanged).

- [ ] **Step 2: Write the failing tests**

Create `src/components/ReturnsBand.test.tsx`:

```tsx
import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ReturnsBand from "./ReturnsBand";
import { groupReturnsByCurrency } from "../lib/derive/returns";
import { account, flow } from "../../tests/helpers/fixture";

// The spec's worked example: deposited 10,000; withdrawn 4,000; balance
// 9,000; floating 500 → profit 3,500, gain +35%.
function specExampleGroup() {
  const acct = account({ balance: 9000, equity: 9500 });
  const flows = [flow({ profit: 10000 }), flow({ profit: -4000 })];
  return groupReturnsByCurrency([acct], flows, [], null).get("USD")!;
}

test("renders the lifetime tiles", () => {
  render(<ReturnsBand currency="USD" group={specExampleGroup()} filtersActive={false} />);
  const band = screen.getByRole("region", { name: /usd account returns/i });
  expect(within(band).getByText("Deposited").nextSibling).toHaveTextContent("10,000.00 USD");
  expect(within(band).getByText("Withdrawn").nextSibling).toHaveTextContent("4,000.00 USD");
  expect(within(band).getByText("Floating").nextSibling).toHaveTextContent("+500.00 USD");
  expect(within(band).getByText("Profit").nextSibling).toHaveTextContent("+3,500.00 USD");
  expect(within(band).getByText("Gain").nextSibling).toHaveTextContent("+35.0%");
  expect(within(band).queryByText("Adjustments")).toBeNull(); // zero → hidden
  expect(within(band).queryByRole("table")).toBeNull(); // one account → no table
  expect(within(band).queryByText(/not affected by/i)).toBeNull();
});

test("shows the adjustments tile only when non-zero", () => {
  const acct = account({ balance: 1050, equity: 1050 });
  const group = groupReturnsByCurrency(
    [acct],
    [flow({ profit: 1000 }), flow({ type: 6, profit: 50 })],
    [],
    null,
  ).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  expect(screen.getByText("Adjustments").nextSibling).toHaveTextContent("+50.00 USD");
});

test("notes when filters are active", () => {
  render(<ReturnsBand currency="USD" group={specExampleGroup()} filtersActive={true} />);
  expect(
    screen.getByText("Not affected by date, symbol, or magic filters."),
  ).toBeInTheDocument();
});

test("multi-account groups get a per-account table and reconciliation note", () => {
  const good = account({ login: 111, label: "Trend EA", balance: 1000, equity: 1000 });
  const bad = account({ login: 222, label: "Scalper EA", balance: 900, equity: 900 });
  const flows = [
    flow({ account: 111, profit: 1000 }),
    // 500 deposited but balance 900 and no deals → does not reconcile
    flow({ account: 222, profit: 500 }),
  ];
  const group = groupReturnsByCurrency([good, bad], flows, [], null).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  const table = screen.getByRole("table");
  expect(within(table).getByText("Trend EA")).toBeInTheDocument();
  expect(within(table).getByRole("row", { name: /scalper ea/i })).toHaveTextContent("*");
  expect(
    screen.getByText(/Scalper EA: cash flows \+ trade P&L don't reconcile/),
  ).toBeInTheDocument();
});

test("gain renders n/a with neutral tone when nothing was deposited", () => {
  const group = groupReturnsByCurrency([account()], [], [], null).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  const gain = screen.getByText("Gain").nextSibling;
  expect(gain).toHaveTextContent("n/a");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/ReturnsBand.test.tsx`
Expected: FAIL — `./ReturnsBand` does not exist.

- [ ] **Step 4: Write the component**

Create `src/components/ReturnsBand.tsx`:

```tsx
import StatTile, { tone } from "./StatTile";
import { money, num, signedMoney, signedPct } from "../lib/format";
import type { AccountReturns, ReturnsGroup } from "../lib/derive/returns";

interface Props {
  currency: string;
  group: ReturnsGroup;
  /** True when a date, symbol, or magic filter is set — shows the caption. */
  filtersActive: boolean;
}

function accountName(a: AccountReturns): string {
  return a.label || String(a.login);
}

/**
 * Lifetime money-in/out for one currency group. Deliberately unaffected by
 * the date, symbol, and magic filters — see the account returns spec.
 */
export default function ReturnsBand({ currency, group, filtersActive }: Props) {
  const t = group.totals;
  const failing = group.accounts.filter((a) => !a.reconciles);
  return (
    <section aria-label={`${currency} account returns`} className="mb-4">
      <h3 className="mb-2 font-mono text-xs font-semibold tracking-widest text-muted uppercase">
        Account returns — lifetime
      </h3>
      {filtersActive && (
        <p className="mb-2 text-xs text-muted">
          Not affected by date, symbol, or magic filters.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Deposited" value={money(t.deposits, currency)} />
        <StatTile label="Withdrawn" value={money(t.withdrawals, currency)} />
        <StatTile
          label="Floating"
          value={signedMoney(t.floating, currency)}
          tone={tone(t.floating)}
        />
        <StatTile
          label="Profit"
          value={signedMoney(t.profit, currency)}
          tone={tone(t.profit)}
        />
        <StatTile
          label="Gain"
          value={signedPct(t.gainPct)}
          tone={t.gainPct === null ? "neutral" : tone(t.gainPct)}
        />
        {t.adjustments !== 0 && (
          <StatTile
            label="Adjustments"
            value={signedMoney(t.adjustments, currency)}
            tone={tone(t.adjustments)}
          />
        )}
      </div>
      {group.accounts.length > 1 && (
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted uppercase">
              <th className="py-1 pr-3 font-normal">Account</th>
              <th className="py-1 pr-3 text-right font-normal">Deposited</th>
              <th className="py-1 pr-3 text-right font-normal">Withdrawn</th>
              <th className="py-1 pr-3 text-right font-normal">Balance</th>
              <th className="py-1 pr-3 text-right font-normal">Floating</th>
              <th className="py-1 pr-3 text-right font-normal">Profit</th>
              <th className="py-1 text-right font-normal">Gain</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {group.accounts.map((a) => (
              <tr key={a.login} className="border-t border-border">
                <td className="py-1.5 pr-3 font-sans">
                  {accountName(a)}
                  {!a.reconciles && " *"}
                </td>
                <td className="py-1.5 pr-3 text-right">{num(a.deposits)}</td>
                <td className="py-1.5 pr-3 text-right">{num(a.withdrawals)}</td>
                <td className="py-1.5 pr-3 text-right">{num(a.balance)}</td>
                <td className="py-1.5 pr-3 text-right">{num(a.floating)}</td>
                <td className="py-1.5 pr-3 text-right">{num(a.profit)}</td>
                <td className="py-1.5 text-right">{signedPct(a.gainPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {failing.map((a) => (
        <p key={a.login} className="mt-2 text-xs text-muted">
          {accountName(a)}: cash flows + trade P&L don&apos;t reconcile with
          the balance — snapshot deal history may be incomplete.
        </p>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/ReturnsBand.test.tsx src/views/Overview.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ReturnsBand.tsx src/components/ReturnsBand.test.tsx src/components/StatTile.tsx src/views/Overview.tsx
git commit -m "feat: add the account returns band component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Account-driven Overview sections

**Files:**
- Modify: `src/store/selectors.ts`, `src/views/Overview.tsx`
- Test: `src/views/Overview.test.tsx`

**Interfaces:**
- Consumes: `groupReturnsByCurrency`, `ReturnsGroup` (Task 2); `ReturnsBand` (Task 3); existing `useApp`, `useCurrencyGroups`, `EMPTY_FILTERS`.
- Produces: `useReturnsGroups(): Map<string, ReturnsGroup>` in `src/store/selectors.ts`; Overview sections keyed by account currencies (union with deal currencies), each rendering the returns band after the trading tiles.

- [ ] **Step 1: Update the existing tests that the band's region breaks**

In `src/views/Overview.test.tsx` the queries `getByRole("region", { name: /usd/i })` now match two regions ("USD overview" and "USD account returns"). Make them exact:

- Line 36: `screen.getByRole("region", { name: /usd/i })` → `screen.getByRole("region", { name: /usd overview/i })`
- Lines 60–61: `/usd/i` → `/usd overview/i`, `/eur/i` → `/eur overview/i`

- [ ] **Step 2: Write the failing tests**

Append to `src/views/Overview.test.tsx` (extend the fixture import with `flow`, and add `import { EMPTY_FILTERS } from "../lib/derive/filters";`):

```tsx
test("returns band ignores the date filter while trading tiles react", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [account({ login: 111, balance: 1030, equity: 1030 })],
      closed_deals: [
        // 2025-06-15 and 2025-08-23; nets +10 and +20
        deal({ account: 111, time: 1750000000, profit: 10, commission: 0 }),
        deal({ account: 111, time: 1756000000, profit: 20, commission: 0 }),
      ],
      cash_flows: [flow({ account: 111, profit: 1000 })],
    }),
    filters: { ...EMPTY_FILTERS, from: "2025-08-01" },
  });
  render(<Overview />);
  const usd = screen.getByRole("region", { name: /usd overview/i });
  expect(within(usd).getByText("Net P&L").nextSibling).toHaveTextContent("+20.00 USD"); // filtered
  const band = screen.getByRole("region", { name: /usd account returns/i });
  expect(within(band).getByText("Deposited").nextSibling).toHaveTextContent("1,000.00 USD"); // lifetime
  expect(within(band).getByText("Profit").nextSibling).toHaveTextContent("+30.00 USD");
  expect(
    within(band).getByText("Not affected by date, symbol, or magic filters."),
  ).toBeInTheDocument();
});

test("sections persist when the date filter excludes every deal", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [account({ login: 111, balance: 1030, equity: 1030 })],
      closed_deals: [deal({ account: 111, time: 1750000000, profit: 30, commission: 0 })],
      cash_flows: [flow({ account: 111, profit: 1000 })],
    }),
    filters: { ...EMPTY_FILTERS, from: "2030-01-01" },
  });
  render(<Overview />);
  expect(screen.getByText(/no closed deals match/i)).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /usd account returns/i })).toBeInTheDocument();
});

test("an empty account filter renders the no-accounts message", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({}),
    filters: { ...EMPTY_FILTERS, accounts: [] },
  });
  render(<Overview />);
  expect(screen.getByText(/no accounts match/i)).toBeInTheDocument();
  expect(screen.queryByRole("region")).toBeNull();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/views/Overview.test.tsx`
Expected: the three new tests FAIL (no returns band, sections still deal-driven); the pre-existing tests PASS.

- [ ] **Step 4: Add the selector**

Append to `src/store/selectors.ts` (extend imports: `groupReturnsByCurrency` and type `ReturnsGroup` from `../lib/derive/returns`):

```ts
/**
 * Lifetime returns per account currency. Applies only the account filter —
 * never date/symbol/magic. Semantics are this repo's own (the account
 * returns spec), not mirrored from mt5-pnl-cli.
 */
export function useReturnsGroups(): Map<string, ReturnsGroup> {
  const snapshot = useApp((s) => s.snapshot);
  const accounts = useApp((s) => s.filters.accounts);
  return useMemo(
    () =>
      groupReturnsByCurrency(
        snapshot?.accounts ?? [],
        snapshot?.cash_flows ?? [],
        snapshot?.closed_deals ?? [],
        accounts,
      ),
    [snapshot, accounts],
  );
}
```

- [ ] **Step 5: Rework Overview**

In `src/views/Overview.tsx`:

1. Extend imports:

```ts
import { useApp } from "../store/app";
import { useCurrencyGroups, useReturnsGroups } from "../store/selectors";
import ReturnsBand from "../components/ReturnsBand";
import type { ReturnsGroup } from "../lib/derive/returns";
```

2. Change `CurrencySection`'s signature and body — new props, band after the tiles, empty-deals message in place of tiles and charts:

```tsx
function CurrencySection({
  currency,
  deals,
  returns,
  filtersActive,
}: {
  currency: string;
  deals: ClosedDeal[];
  returns: ReturnsGroup | undefined;
  filtersActive: boolean;
}) {
```

The existing `stats`/`curve`/`dd`/`monthly`/`daily` memos stay unchanged (they handle empty `deals`). Replace the returned JSX's body — heading unchanged, then:

```tsx
  return (
    <section aria-label={`${currency} overview`} className="mb-10">
      <h2 className="mb-3 font-mono text-sm font-semibold tracking-widest text-muted uppercase">
        {currency}
      </h2>
      {deals.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* the eight existing StatTiles, unchanged */}
        </div>
      ) : (
        <p className="mb-4 text-muted">No closed deals match the current filters.</p>
      )}
      {returns && (
        <ReturnsBand currency={currency} group={returns} filtersActive={filtersActive} />
      )}
      {deals.length > 0 && (
        <>
          {/* the existing equity Chart and the monthly/daily grid, unchanged */}
        </>
      )}
    </section>
  );
```

3. Rework the default export — sections come from the union of account-derived and deal-derived currencies (deal-only currencies, e.g. deals whose account is missing from `accounts`, still get a trading section):

```tsx
export default function Overview() {
  const dealGroups = useCurrencyGroups();
  const returnsGroups = useReturnsGroups();
  const filtersActive = useApp(
    (s) =>
      s.filters.from !== null ||
      s.filters.to !== null ||
      s.filters.symbol !== null ||
      s.filters.magic !== null,
  );
  const currencies = [
    ...new Set([...returnsGroups.keys(), ...dealGroups.keys()]),
  ].sort();
  return (
    <div>
      {currencies.length > 1 && (
        <p className="mb-6 border-l-2 border-accent bg-surface py-2 pr-3 pl-3 text-sm text-muted">
          Accounts in scope span multiple currencies; figures are shown per
          currency and never combined.
        </p>
      )}
      {currencies.map((currency) => (
        <CurrencySection
          key={currency}
          currency={currency}
          deals={dealGroups.get(currency) ?? []}
          returns={returnsGroups.get(currency)}
          filtersActive={filtersActive}
        />
      ))}
      {currencies.length === 0 && (
        <p className="text-muted">No accounts match the current filters.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the full unit suite and lint**

Run: `npm test && npm run lint`
Expected: PASS. If a pre-existing test asserts the old "No closed deals match the current filters." top-level message, update it to match the new per-section placement.

- [ ] **Step 7: Commit**

```bash
git add src/store/selectors.ts src/views/Overview.tsx src/views/Overview.test.tsx
git commit -m "feat: show lifetime account returns on the overview

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: e2e fixture and assertions

**Files:**
- Modify: `scripts/build-e2e-fixture.mjs`, `e2e/app.spec.ts`
- Generated: `e2e/fixtures/snapshot.json.gz.age`

**Interfaces:**
- Consumes: the running app (Tasks 1–4); `dropFixture` from `e2e/fixture.ts`; FilterBar's date input labelled "From".
- Produces: a fixture whose USD account reconciles with hand-checkable gain (+2.0%) and whose EUR account deliberately does not reconcile (gain +25.0%).

- [ ] **Step 1: Extend the fixture generator**

In `scripts/build-e2e-fixture.mjs`, add a `flow` helper after `deal` (line 10):

```js
// Balance-family record: trade fields zeroed, amount in `profit`.
const flow = (o) => deal({ type: 2, entry: 0, magic: 0, volume: 0, price: 0, profit: 0, commission: 0, symbol: "", ...o });
```

Replace the `accounts` and `cash_flows` blocks:

```js
  accounts: [
    // USD reconciles: 10,000 − 2,000 + 45 (Σ closed-deal nets: 51 profit − 6
    // commission) = 8,045; equity 8,200 → floating +155, gain +2.0%.
    { login: 1234567, label: "Trend EA", currency: "USD", balance: 8045, equity: 8200, last_success_at: "2026-07-01T00:00:00Z", last_error: null },
    // EUR deliberately does not reconcile: 4,000 + 4.5 ≠ 5,000 — exercises
    // the incomplete-history note; profit 1,000, gain +25.0%.
    { login: 7654321, label: "Scalper EA", currency: "EUR", balance: 5000, equity: 5000, last_success_at: "2026-07-01T00:00:00Z", last_error: null },
  ],
```

```js
  cash_flows: [
    flow({ account: 1234567, ticket: 1000, profit: 10000, comment: "Deposit", time: start - 30 * DAY, time_msc: (start - 30 * DAY) * 1000 }),
    flow({ account: 1234567, ticket: 1001, profit: -2000, comment: "Withdrawal", time: start + 40 * DAY, time_msc: (start + 40 * DAY) * 1000 }),
    flow({ account: 7654321, ticket: 1002, profit: 4000, comment: "Deposit", time: start - 30 * DAY, time_msc: (start - 30 * DAY) * 1000 }),
  ],
```

(The old single deposit used bare `deal(...)`, which carried `deal`'s default `commission: -0.5` — the `flow` helper fixes that.)

- [ ] **Step 2: Rebuild the fixture**

Run: `node scripts/build-e2e-fixture.mjs`
Expected: `wrote e2e/fixtures/snapshot.json.gz.age`

- [ ] **Step 3: Add the e2e test**

Append to `e2e/app.spec.ts`:

```ts
test("renders lifetime account returns that survive filtering", async ({ page }) => {
  await page.goto("");
  await dropFixture(page);
  await page.getByLabel(/passphrase/i).fill("e2e-passphrase");
  await page.getByRole("button", { name: /unlock/i }).click();

  // USD: deposited 10,000; withdrawn 2,000; balance 8,045; equity 8,200
  // → floating +155, profit +200, gain +2.0% (reconciles: 8,000 + 45).
  const usd = page.getByRole("region", { name: /usd account returns/i });
  await expect(usd.getByText("10,000.00 USD")).toBeVisible();
  await expect(usd.getByText("2,000.00 USD")).toBeVisible();
  await expect(usd.getByText("+155.00 USD")).toBeVisible();
  await expect(usd.getByText("+200.00 USD")).toBeVisible();
  await expect(usd.getByText("+2.0%")).toBeVisible();

  // EUR: deposited 4,000 against balance 5,000 with only 4.50 of deal nets
  // → the deliberate reconciliation failure; profit 1,000, gain +25.0%.
  const eur = page.getByRole("region", { name: /eur account returns/i });
  await expect(eur.getByText("+25.0%")).toBeVisible();
  await expect(eur.getByText(/don't reconcile/)).toBeVisible();

  // Lifetime: a date filter that excludes every deal leaves the band intact.
  await page.getByLabel("From").fill("2027-01-01");
  await expect(page.getByText(/no closed deals match/i).first()).toBeVisible();
  await expect(usd.getByText("10,000.00 USD")).toBeVisible();
  await expect(
    page.getByText("Not affected by date, symbol, or magic filters.").first(),
  ).toBeVisible();
});
```

- [ ] **Step 4: Run the e2e suite**

Run: `npm run e2e`
Expected: PASS, including the three pre-existing tests (the fixture's closed deals are unchanged, so the Overview/Calendar/Strategies assertions still hold).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-e2e-fixture.mjs e2e/app.spec.ts e2e/fixtures/snapshot.json.gz.age
git commit -m "test: cover account returns end-to-end with a reconciling fixture

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Visual review, screenshot, docs

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-07-07-account-returns-design.md`
- Generated: `docs/screenshot.png` (via `npm run screenshot` — never hand-taken)

**Interfaces:**
- Consumes: the finished feature (Tasks 1–5).
- Produces: refreshed screenshot and documentation; no code changes unless the visual review finds a layout defect.

- [ ] **Step 1: Visual inspection**

Run: `npm run visual`
Then open each capture in `visual-review/` (they are PNGs — view them, don't just list them) and check the Overview: the band sits between the trading tiles and the equity curve, tile spacing matches the trading grid, the per-account table columns align right for figures, and pos/neg tones render on Floating/Profit/Gain. Fix any layout defect found and re-run before proceeding.

- [ ] **Step 2: Regenerate the committed screenshot**

Run: `npm run screenshot`
Expected: `docs/screenshot.png` updated (the Overview now shows the returns band).

- [ ] **Step 3: Update the docs**

- `README.md`: in the features/views description, add one factual sentence to the Overview entry: lifetime account returns (deposited, withdrawn, floating, profit, percentage gain) per currency group, affected by the account filter only.
- `CLAUDE.md` Architecture: add `returns.ts` to the `src/lib/derive/` list and `useReturnsGroups` to the selectors line.
- `CLAUDE.md` Gotchas: add:

```markdown
- **Returns semantics are this repo's own** — the account returns band
  (deposited/withdrawn/floating/profit/gain) is defined by
  `docs/superpowers/specs/2026-07-07-account-returns-design.md`, not
  mirrored from mt5-pnl-cli. Lifetime figures, identity-based profit
  (`withdrawals + equity − deposits`), account filter only — date,
  symbol, and magic filters must never affect them.
```

- Spec amendment: in `docs/superpowers/specs/2026-07-07-account-returns-design.md`, change the two occurrences of rendering null gain as `"—"` to `"n/a"` (the app-wide convention `pct`/`ratio` already use; the spec's dash predates checking that convention).

- [ ] **Step 4: Full verification**

Run: `npm test && npm run lint && npm run build && npm run e2e`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/screenshot.png docs/superpowers/specs/2026-07-07-account-returns-design.md
git commit -m "docs: document the account returns band and refresh the screenshot

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
