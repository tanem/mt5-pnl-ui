import { NavLink, Outlet } from "react-router-dom";
import { useApp } from "../store/app";
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
      <header className="flex flex-wrap items-center gap-4 border-b p-3">
        <span className="font-semibold">mt5-pnl-ui</span>
        <nav className="flex gap-3">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) => (isActive ? "font-semibold underline" : "")}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <span className="ml-auto text-sm">
          <span>{fileName}</span> · exported {generatedAt}
        </span>
        <button type="button" onClick={reset} className="border px-2 py-1 text-sm">
          Close
        </button>
      </header>
      <FilterBar />
      <div className="flex-1 p-4">
        <Outlet />
      </div>
    </div>
  );
}
