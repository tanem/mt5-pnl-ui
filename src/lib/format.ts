const grouped = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1,234.50 USD" — deterministic, currency code as suffix (CLI style). */
export function money(v: number, currency: string): string {
  return `${grouped.format(v)} ${currency}`;
}

export function signedMoney(v: number, currency: string): string {
  return v > 0 ? `+${money(v, currency)}` : money(v, currency);
}

/** 0.528 → "52.8%"; null → "n/a". */
export function pct(v: number | null): string {
  return v === null ? "n/a" : `${(v * 100).toFixed(1)}%`;
}

/** 1.3612 → "1.36"; null → "n/a". */
export function ratio(v: number | null): string {
  return v === null ? "n/a" : v.toFixed(2);
}

/** "2026-07-05T00:00:00Z" → "2026-07-05 00:00 UTC" — deterministic, always UTC. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}
