import { NavLink, Outlet } from "react-router-dom";
import { useApp } from "../store/app";
import { formatTimestamp } from "../lib/format";
import FilterBar from "./FilterBar";

const tabs = [
  { to: "/", label: "Overview" },
  { to: "/calendar", label: "Calendar" },
  { to: "/trades", label: "Trades" },
  { to: "/strategies", label: "Strategies" },
];

export default function Layout() {
  const fileName = useApp((s) => s.fileName);
  const generatedAt = useApp((s) => s.snapshot?.generated_at);
  const reset = useApp((s) => s.reset);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur">
        <span className="font-mono text-sm font-semibold tracking-tight text-text">
          mt5<span className="text-accent">-</span>pnl-ui
        </span>
        <nav className="flex gap-4">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `border-b-2 pb-0.5 text-sm transition-colors ${
                  isActive
                    ? "border-accent font-semibold text-text"
                    : "border-transparent text-muted hover:text-text"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <span className="ml-auto text-xs text-muted tabular-nums">
          <span className="text-text">{fileName}</span> · exported{" "}
          {generatedAt ? formatTimestamp(generatedAt) : generatedAt}
        </span>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-2.5 py-1 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          Close
        </button>
      </header>
      <FilterBar />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
