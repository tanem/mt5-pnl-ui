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
  const magics = useMemo(
    () => [...new Set(deals.map((d) => d.magic))].sort((a, b) => a - b),
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

  const selectedMagics = filters.magics ?? magics;

  function toggleMagic(magic: number) {
    const next = selectedMagics.includes(magic)
      ? selectedMagics.filter((m) => m !== magic)
      : [...selectedMagics, magic];
    // all magics on = no filter
    setFilters({ magics: next.length === magics.length ? null : next });
  }

  return (
    <section
      aria-label="Filters"
      className="mx-auto flex w-full max-w-6xl flex-wrap items-end gap-x-5 gap-y-3 border-b border-border px-4 py-3"
    >
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="text-xs tracking-wide text-muted uppercase">
          Accounts
        </legend>
        {accounts.map((a) => (
          <label
            key={a.login}
            className="flex items-center gap-1.5 text-sm text-text"
          >
            <input
              type="checkbox"
              checked={selected.includes(a.login)}
              onChange={() => toggleAccount(a.login)}
            />
            {a.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-xs tracking-wide text-muted uppercase">
        From
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => setFilters({ from: e.target.value || null })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs tracking-wide text-muted uppercase">
        To
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => setFilters({ to: e.target.value || null })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs tracking-wide text-muted uppercase">
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

      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="text-xs tracking-wide text-muted uppercase">
          Magic
        </legend>
        {magics.map((m) => (
          <label
            key={m}
            className="flex items-center gap-1.5 text-sm text-text"
          >
            <input
              type="checkbox"
              checked={selectedMagics.includes(m)}
              onChange={() => toggleMagic(m)}
            />
            {m}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
