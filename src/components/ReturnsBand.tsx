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
