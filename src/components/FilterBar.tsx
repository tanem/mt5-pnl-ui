import { useMemo } from "react";
import { useApp } from "../store/app";
import { useAccounts } from "../store/selectors";

export default function FilterBar() {
  const accounts = useAccounts();
  const deals = useApp((s) => s.snapshot?.closed_deals ?? []);
  const filters = useApp((s) => s.filters);
  const setFilters = useApp((s) => s.setFilters);

  const symbols = useMemo(
    () => [...new Set(deals.map((d) => d.symbol))].sort(),
    [deals],
  );
  const selected = filters.accounts ?? accounts.map((a) => a.login);

  function toggleAccount(login: number) {
    const next = selected.includes(login)
      ? selected.filter((l) => l !== login)
      : [...selected, login];
    // all accounts on = no filter
    setFilters({ accounts: next.length === accounts.length ? null : next });
  }

  return (
    <section aria-label="Filters" className="flex flex-wrap items-end gap-4 border-b p-3">
      <fieldset className="flex gap-2">
        <legend className="text-sm">Accounts</legend>
        {accounts.map((a) => (
          <label key={a.login} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={selected.includes(a.login)}
              onChange={() => toggleAccount(a.login)}
            />
            {a.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col text-sm">
        From
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => setFilters({ from: e.target.value || null })}
        />
      </label>
      <label className="flex flex-col text-sm">
        To
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => setFilters({ to: e.target.value || null })}
        />
      </label>

      <label className="flex flex-col text-sm">
        Symbol
        <select
          value={filters.symbol ?? ""}
          onChange={(e) => setFilters({ symbol: e.target.value || null })}
        >
          <option value="">All</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-sm">
        Magic
        <input
          type="number"
          value={filters.magic ?? ""}
          onChange={(e) =>
            setFilters({
              magic: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </label>
    </section>
  );
}
