import StatTile, { tone } from "./StatTile";
import { money, signedMoney, signedPct } from "../lib/format";
import type { ReturnsGroup } from "../lib/derive/returns";

const RECONCILE_NOTE =
  "Cash flows + trade P&L don't reconcile with the balance — snapshot deal history may be incomplete.";

interface Props {
  currency: string;
  group: ReturnsGroup;
  /** True when a date, symbol, or magic filter is set — shows the caption. */
  filtersActive: boolean;
}

/**
 * Lifetime money-in/out for one currency group. Deliberately unaffected by
 * the date, symbol, and magic filters — see the account returns spec.
 */
export default function ReturnsBand({ currency, group, filtersActive }: Props) {
  const t = group.totals;
  const reconciles = group.accounts.every((a) => a.reconciles);
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
        {t.transfers !== 0 && (
          <StatTile label="Transferred" value={money(t.transfers, currency)} />
        )}
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
      {!reconciles && <p className="mt-2 text-xs text-muted">{RECONCILE_NOTE}</p>}
    </section>
  );
}
