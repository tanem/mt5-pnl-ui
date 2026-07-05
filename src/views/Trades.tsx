import { useMemo, useRef, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useApp } from "../store/app";
import { useAccounts, useFilteredDeals } from "../store/selectors";
import { applyFilters } from "../lib/derive/filters";
import { dealNet } from "../lib/derive/stats";
import type { CashFlow, ClosedDeal, OpenPosition } from "../lib/snapshot/types";

const grouped = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function iso(timeSec: number): string {
  return new Date(timeSec * 1000).toISOString().replace(".000Z", "Z");
}

const TABS = ["Closed deals", "Open positions", "Cash flows"] as const;
type Tab = (typeof TABS)[number];

export default function Trades() {
  const [tab, setTab] = useState<Tab>("Closed deals");
  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`border px-3 py-1 ${tab === t ? "font-semibold" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Closed deals" && <ClosedDeals />}
      {tab === "Open positions" && <OpenPositions />}
      {tab === "Cash flows" && <CashFlows />}
    </div>
  );
}

function useLabelByLogin(): Map<number, string> {
  const accounts = useAccounts();
  return useMemo(
    () => new Map(accounts.map((a) => [a.login, a.label])),
    [accounts],
  );
}

const col = createColumnHelper<ClosedDeal>();

function ClosedDeals() {
  const deals = useFilteredDeals();
  const labels = useLabelByLogin();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "time", desc: true },
  ]);

  const columns = useMemo(
    () => [
      col.accessor("time", { header: "Time", cell: (c) => iso(c.getValue()) }),
      col.accessor("account", {
        header: "Account",
        cell: (c) => labels.get(c.getValue()) ?? String(c.getValue()),
      }),
      col.accessor("symbol", { header: "Symbol" }),
      col.accessor("magic", { header: "Magic" }),
      col.accessor("volume", { header: "Volume" }),
      col.accessor("price", { header: "Price" }),
      col.accessor("profit", { header: "Profit", cell: (c) => grouped.format(c.getValue()) }),
      col.accessor("swap", { header: "Swap", cell: (c) => grouped.format(c.getValue()) }),
      col.accessor("commission", { header: "Commission", cell: (c) => grouped.format(c.getValue()) }),
      col.accessor("fee", { header: "Fee", cell: (c) => grouped.format(c.getValue()) }),
      col.accessor((d) => dealNet(d), {
        id: "net",
        header: "Net",
        cell: (c) => grouped.format(c.getValue()),
      }),
    ],
    [labels],
  );

  const table = useReactTable({
    sortDescFirst: false,
    data: deals,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
    initialRect: { width: 800, height: 600 }, // jsdom has no layout
  });

  if (rows.length === 0) return <p>No closed deals match the current filters.</p>;

  return (
    <div ref={parentRef} className="max-h-[70vh] overflow-auto border">
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="p-2 text-left">
                  <button
                    type="button"
                    onClick={h.column.getToggleSortingHandler()}
                    className="font-semibold"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index]!;
            return (
              <tr
                key={row.id}
                style={{
                  position: "absolute",
                  transform: `translateY(${vi.start}px)`,
                  width: "100%",
                  display: "table",
                  tableLayout: "fixed",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="p-2"
                    data-testid={`cell-${cell.column.id}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OpenPositions() {
  const positions = useApp((s) => s.snapshot?.open_positions ?? []);
  const filters = useApp((s) => s.filters);
  const labels = useLabelByLogin();
  const rows = useMemo(() => applyFilters(positions, filters), [positions, filters]);
  if (rows.length === 0) return <p>No open positions.</p>;
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr>
          {["Opened", "Account", "Symbol", "Magic", "Volume", "Open", "Current", "SL", "TP", "Profit", "Swap"].map((h) => (
            <th key={h} className="p-2 text-left">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((p: OpenPosition) => (
          <tr key={`${p.account}-${p.ticket}`}>
            <td className="p-2">{iso(p.time)}</td>
            <td className="p-2">{labels.get(p.account) ?? p.account}</td>
            <td className="p-2">{p.symbol}</td>
            <td className="p-2">{p.magic}</td>
            <td className="p-2">{p.volume}</td>
            <td className="p-2">{p.price_open}</td>
            <td className="p-2">{p.price_current}</td>
            <td className="p-2">{p.sl}</td>
            <td className="p-2">{p.tp}</td>
            <td className="p-2">{grouped.format(p.profit)}</td>
            <td className="p-2">{grouped.format(p.swap)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CashFlows() {
  const flows = useApp((s) => s.snapshot?.cash_flows ?? []);
  const filters = useApp((s) => s.filters);
  const labels = useLabelByLogin();
  // Cash flows have empty symbol / zero magic; only account & date apply.
  const rows = useMemo(
    () => applyFilters(flows, { ...filters, symbol: null, magic: null }),
    [flows, filters],
  );
  if (rows.length === 0) return <p>No cash flows.</p>;
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr>
          {["Time", "Account", "Type", "Amount", "Comment"].map((h) => (
            <th key={h} className="p-2 text-left">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((f: CashFlow) => (
          <tr key={`${f.account}-${f.ticket}`}>
            <td className="p-2">{iso(f.time)}</td>
            <td className="p-2">{labels.get(f.account) ?? f.account}</td>
            <td className="p-2">{f.type}</td>
            <td className="p-2">{grouped.format(f.profit)}</td>
            <td className="p-2">{f.comment}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
