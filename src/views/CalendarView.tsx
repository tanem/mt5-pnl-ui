import { useMemo, useState, type CSSProperties } from "react";
import { useCurrencyGroups } from "../store/selectors";
import { bucketByDayUTC, type Bucket } from "../lib/derive/buckets";
import { signedMoney } from "../lib/format";
import type { ClosedDeal } from "../lib/snapshot/types";

/** Day keys of one month padded with nulls to whole Monday-start weeks. */
export function buildMonthCells(year: number, month0: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(Date.UTC(year, month0, d)).toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function latestDealTime(deals: ClosedDeal[]): number {
  return deals.length
    ? deals.reduce((m, d) => (d.time > m ? d.time : m), 0)
    : Date.now() / 1000;
}

function MonthGrid({ currency, deals }: { currency: string; deals: ClosedDeal[] }) {
  const [year, setYear] = useState(() => new Date(latestDealTime(deals) * 1000).getUTCFullYear());
  const [month0, setMonth0] = useState(() => new Date(latestDealTime(deals) * 1000).getUTCMonth());

  const days: Map<string, Bucket> = useMemo(() => bucketByDayUTC(deals), [deals]);
  const cells = useMemo(() => buildMonthCells(year, month0), [year, month0]);

  const prefix = `${year}-${String(month0 + 1).padStart(2, "0")}`;
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

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth0(d.getUTCMonth());
  }

  return (
    <section aria-label={`${currency} calendar`} className="mb-10">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-mono text-sm font-semibold tracking-widest text-muted uppercase">
          {currency}
        </h2>
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="rounded-md border border-border px-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          ‹
        </button>
        <span className="text-sm font-medium tabular-nums">
          {MONTHS[month0]} {year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shift(1)}
          className="rounded-md border border-border px-2 text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          ›
        </button>
      </div>

      <div role="grid" aria-label={`${MONTHS[month0]} ${year}`} className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            role="columnheader"
            className="pb-1 text-center text-xs tracking-wide text-muted uppercase"
          >
            {w}
          </div>
        ))}
        {cells.map((key, i) =>
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
      </div>

      <p className="mt-3 text-sm text-muted">
        Month total:{" "}
        <span className="font-mono font-semibold text-text tabular-nums">
          {signedMoney(monthNet, currency)}
        </span>{" "}
        · {monthTrades} trades
      </p>
    </section>
  );
}

export default function CalendarView() {
  const groups = useCurrencyGroups();
  const entries = [...groups.entries()];
  if (entries.length === 0)
    return <p className="text-muted">No closed deals match the current filters.</p>;
  return (
    <div>
      {entries.map(([currency, deals]) => (
        <MonthGrid key={currency} currency={currency} deals={deals} />
      ))}
    </div>
  );
}
