import type { AccountSnapshot } from "../snapshot/types";

export function currencyByLogin(
  accounts: AccountSnapshot[],
): Map<number, string> {
  return new Map(accounts.map((a) => [a.login, a.currency]));
}

/**
 * Group rows by their account's currency. Views aggregate within a group
 * and never across groups — figures in different currencies must not be
 * summed (mirrors mt5-pnl-cli's mixed-currency guard).
 */
export function splitByCurrency<T extends { account: number }>(
  rows: T[],
  accounts: AccountSnapshot[],
): Map<string, T[]> {
  const byLogin = currencyByLogin(accounts);
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const ccy = byLogin.get(r.account) ?? "?";
    const group = out.get(ccy);
    if (group) group.push(r);
    else out.set(ccy, [r]);
  }
  return out;
}
