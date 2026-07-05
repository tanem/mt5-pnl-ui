import { useMemo, useState } from "react";
import { useAccounts, useCurrencyGroups } from "../store/selectors";
import { computeStats } from "../lib/derive/stats";
import { equityCurve, maxDrawdown } from "../lib/derive/equity";
import { money, pct, ratio, signedMoney } from "../lib/format";
import { LINE } from "../lib/chartTheme";
import Chart from "../components/Chart";
import type { ClosedDeal } from "../lib/snapshot/types";

type GroupBy = "account" | "magic";

function groupDeals(
  deals: ClosedDeal[],
  by: GroupBy,
  labelByLogin: Map<number, string>,
): Map<string, ClosedDeal[]> {
  const out = new Map<string, ClosedDeal[]>();
  for (const d of deals) {
    const key =
      by === "account"
        ? (labelByLogin.get(d.account) ?? String(d.account))
        : String(d.magic);
    const g = out.get(key);
    if (g) g.push(d);
    else out.set(key, [d]);
  }
  return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function Sparkline({ deals }: { deals: ClosedDeal[] }) {
  const curve = useMemo(() => equityCurve(deals), [deals]);
  return (
    <Chart
      label="equity sparkline"
      className="h-10 w-40"
      option={{
        grid: { left: 0, right: 0, top: 2, bottom: 2 },
        xAxis: { type: "time", show: false },
        yAxis: { type: "value", show: false },
        series: [{
          type: "line",
          showSymbol: false,
          lineStyle: { color: LINE, width: 1 },
          data: curve.map((p) => [p.timeMsc, p.cum]),
        }],
      }}
    />
  );
}

export default function Strategies() {
  const [by, setBy] = useState<GroupBy>("account");
  const groups = useCurrencyGroups();
  const accounts = useAccounts();
  const labelByLogin = useMemo(
    () => new Map(accounts.map((a) => [a.login, a.label])),
    [accounts],
  );

  const entries = [...groups.entries()];
  if (entries.length === 0) return <p>No closed deals match the current filters.</p>;

  return (
    <div>
      <fieldset className="mb-3 flex gap-3">
        <legend className="text-sm">Group by</legend>
        {(["account", "magic"] as const).map((g) => (
          <label key={g} className="flex items-center gap-1">
            <input
              type="radio"
              name="group-by"
              checked={by === g}
              onChange={() => setBy(g)}
            />
            {g === "account" ? "Account" : "Magic"}
          </label>
        ))}
      </fieldset>

      {entries.map(([currency, deals]) => {
        const strategyRows = [...groupDeals(deals, by, labelByLogin).entries()];
        return (
          <section key={currency} aria-label={`${currency} strategies`} className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">{currency}</h2>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr>
                  {[by === "account" ? "Account" : "Magic", "Net P&L", "Win rate", "Profit factor", "Max drawdown", "Trades", "Equity"].map((h) => (
                    <th key={h} className="p-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {strategyRows.map(([key, group]) => {
                  const s = computeStats(group);
                  const dd = maxDrawdown(equityCurve(group));
                  return (
                    <tr key={key}>
                      <td className="p-2">{key}</td>
                      <td className="p-2">{signedMoney(s.netPnl, currency)}</td>
                      <td className="p-2">{pct(s.winRate)}</td>
                      <td className="p-2">{ratio(s.profitFactor)}</td>
                      <td className="p-2">{money(dd, currency)}</td>
                      <td className="p-2">{s.trades}</td>
                      <td className="p-2"><Sparkline deals={group} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
