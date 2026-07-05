import { useMemo } from "react";
import { useCurrencyGroups } from "../store/selectors";
import { computeStats } from "../lib/derive/stats";
import { equityCurve, maxDrawdown } from "../lib/derive/equity";
import { bucketByDayUTC, bucketByMonthUTC, dayKeyUTC } from "../lib/derive/buckets";
import { money, pct, ratio, signedMoney } from "../lib/format";
import { LINE, NEG, POS } from "../lib/chartTheme";
import StatTile from "../components/StatTile";
import Chart from "../components/Chart";
import type { ClosedDeal } from "../lib/snapshot/types";

function tone(v: number): "pos" | "neg" | "neutral" {
  return v > 0 ? "pos" : v < 0 ? "neg" : "neutral";
}

function signColours(values: number[]): { value: number; itemStyle: { color: string } }[] {
  return values.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? POS : NEG } }));
}

function CurrencySection({ currency, deals }: { currency: string; deals: ClosedDeal[] }) {
  const stats = useMemo(() => computeStats(deals), [deals]);
  const curve = useMemo(() => equityCurve(deals), [deals]);
  const dd = useMemo(() => maxDrawdown(curve), [curve]);

  const monthly = useMemo(() => {
    const buckets = bucketByMonthUTC(deals);
    const keys = [...buckets.keys()].sort();
    return { keys, nets: keys.map((k) => buckets.get(k)!.net) };
  }, [deals]);

  const daily = useMemo(() => {
    const buckets = bucketByDayUTC(deals);
    const last = deals.length ? Math.max(...deals.map((d) => d.time)) : 0;
    const keys: string[] = [];
    for (let i = 29; i >= 0; i--) keys.push(dayKeyUTC(last - i * 86400));
    return { keys, nets: keys.map((k) => buckets.get(k)?.net ?? 0) };
  }, [deals]);

  return (
    <section aria-label={`${currency} overview`} className="mb-8">
      <h2 className="mb-2 text-lg font-semibold">{currency}</h2>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Net P&L" value={signedMoney(stats.netPnl, currency)} tone={tone(stats.netPnl)} />
        <StatTile label="Win rate" value={pct(stats.winRate)} />
        <StatTile label="Profit factor" value={ratio(stats.profitFactor)} />
        <StatTile label="Max drawdown" value={money(dd, currency)} tone={tone(dd)} />
        <StatTile label="Trades" value={String(stats.trades)} />
        <StatTile label="Avg win" value={stats.avgWin === null ? "n/a" : money(stats.avgWin, currency)} />
        <StatTile label="Avg loss" value={stats.avgLoss === null ? "n/a" : money(stats.avgLoss, currency)} />
        <StatTile label="Costs" value={money(stats.costs, currency)} tone={tone(stats.costs)} />
      </div>

      <Chart
        label={`Cumulative net P&L (${currency})`}
        option={{
          grid: { left: 60, right: 16, top: 16, bottom: 24 },
          xAxis: { type: "time" },
          yAxis: { type: "value" },
          tooltip: { trigger: "axis" },
          series: [{
            type: "line",
            showSymbol: false,
            lineStyle: { color: LINE },
            data: curve.map((p) => [p.timeMsc, p.cum]),
          }],
        }}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Chart
          label={`Monthly net P&L (${currency})`}
          option={{
            grid: { left: 60, right: 16, top: 16, bottom: 24 },
            xAxis: { type: "category", data: monthly.keys },
            yAxis: { type: "value" },
            tooltip: {},
            series: [{ type: "bar", data: signColours(monthly.nets) }],
          }}
        />
        <Chart
          label={`Last 30 days net P&L (${currency})`}
          option={{
            grid: { left: 60, right: 16, top: 16, bottom: 24 },
            xAxis: { type: "category", data: daily.keys },
            yAxis: { type: "value" },
            tooltip: {},
            series: [{ type: "bar", data: signColours(daily.nets) }],
          }}
        />
      </div>
    </section>
  );
}

export default function Overview() {
  const groups = useCurrencyGroups();
  const entries = [...groups.entries()];
  return (
    <div>
      {entries.length > 1 && (
        <p className="mb-4 text-sm">
          Accounts in scope span multiple currencies; figures are shown per
          currency and never combined.
        </p>
      )}
      {entries.map(([currency, deals]) => (
        <CurrencySection key={currency} currency={currency} deals={deals} />
      ))}
      {entries.length === 0 && <p>No closed deals match the current filters.</p>}
    </div>
  );
}
