import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("../worker/client", () => ({ workerRunner: vi.fn() }));

type CapturedOption = {
  tooltip?: { valueFormatter?: (v: unknown) => string };
};
const captured = vi.hoisted(() => ({ options: [] as unknown[] }));
vi.mock("../components/Chart", () => ({
  default: ({ label, option }: { label: string; option: unknown }) => {
    captured.options.push(option);
    return <div data-testid="chart">{label}</div>;
  },
}));

import { appStore } from "../store/app";
import Overview from "./Overview";
import { account, deal, flow, makeSnapshot } from "../../tests/helpers/fixture";
import { EMPTY_FILTERS } from "../lib/derive/filters";

beforeEach(() => {
  appStore.getState().reset();
  captured.options.length = 0;
});

test("renders tiles with CLI-matching figures for a single currency", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [account({ login: 111, currency: "USD" })],
      closed_deals: [
        deal({ account: 111, profit: 10, commission: -1 }), // net +9
        deal({ account: 111, profit: -6, commission: -1 }), // net -7
      ],
    }),
  });
  render(<Overview />);
  const usd = screen.getByRole("region", { name: /usd overview/i });
  expect(within(usd).getByText("Net P&L").nextSibling).toHaveTextContent("+2.00 USD");
  expect(within(usd).getByText("Win rate").nextSibling).toHaveTextContent("50.0%");
  expect(within(usd).getByText("Profit factor").nextSibling).toHaveTextContent("1.29");
  expect(within(usd).getByText("Max drawdown").nextSibling).toHaveTextContent("-7.00 USD");
  expect(within(usd).getByText("Trades").nextSibling).toHaveTextContent("2");
  expect(within(usd).getByText("Costs").nextSibling).toHaveTextContent("-2.00 USD");
  expect(within(usd).getAllByTestId("chart")).toHaveLength(3); // equity, monthly, daily
});

test("mixed currencies render one section per currency, never a combined total", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [
        account({ login: 111, currency: "USD" }),
        account({ login: 222, currency: "EUR" }),
      ],
      closed_deals: [deal({ account: 111 }), deal({ account: 222 })],
    }),
  });
  render(<Overview />);
  expect(screen.getByRole("region", { name: /usd overview/i })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /eur overview/i })).toBeInTheDocument();
  expect(screen.getByText(/multiple currencies/i)).toBeInTheDocument();
});

test("no losses → profit factor shows n/a", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      closed_deals: [deal({ profit: 10, commission: 0 })],
    }),
  });
  render(<Overview />);
  expect(screen.getByText("Profit factor").nextSibling).toHaveTextContent("n/a");
});

test("every chart tooltip formats values to 2 dp", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      closed_deals: [deal({ profit: 10, commission: 0 })],
    }),
  });
  render(<Overview />);
  expect(captured.options).toHaveLength(3); // equity, monthly, daily
  for (const raw of captured.options) {
    const opt = raw as CapturedOption;
    expect(opt.tooltip?.valueFormatter?.(2434.4699999999993)).toBe("2,434.47");
  }
});

test("returns band ignores the date filter while trading tiles react", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [account({ login: 111, balance: 1030, equity: 1030 })],
      closed_deals: [
        // 2025-06-15 and 2025-08-23; nets +10 and +20
        deal({ account: 111, time: 1750000000, profit: 10, commission: 0 }),
        deal({ account: 111, time: 1756000000, profit: 20, commission: 0 }),
      ],
      cash_flows: [flow({ account: 111, profit: 1000 })],
    }),
    filters: { ...EMPTY_FILTERS, from: "2025-08-01" },
  });
  render(<Overview />);
  const usd = screen.getByRole("region", { name: /usd overview/i });
  expect(within(usd).getByText("Net P&L").nextSibling).toHaveTextContent("+20.00 USD"); // filtered
  const band = screen.getByRole("region", { name: /usd account returns/i });
  expect(within(band).getByText("Deposited").nextSibling).toHaveTextContent("1,000.00 USD"); // lifetime
  expect(within(band).getByText("Profit").nextSibling).toHaveTextContent("+30.00 USD");
  expect(
    within(band).getByText("Not affected by date, symbol, or magic filters."),
  ).toBeInTheDocument();
});

test("sections persist when the date filter excludes every deal", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [account({ login: 111, balance: 1030, equity: 1030 })],
      closed_deals: [deal({ account: 111, time: 1750000000, profit: 30, commission: 0 })],
      cash_flows: [flow({ account: 111, profit: 1000 })],
    }),
    filters: { ...EMPTY_FILTERS, from: "2030-01-01" },
  });
  render(<Overview />);
  expect(screen.getByText(/no closed deals match/i)).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /usd account returns/i })).toBeInTheDocument();
});

test("an empty account filter renders the no-accounts message", () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({}),
    filters: { ...EMPTY_FILTERS, accounts: [] },
  });
  render(<Overview />);
  expect(screen.getByText(/no accounts match/i)).toBeInTheDocument();
  expect(screen.queryByRole("region")).toBeNull();
});
