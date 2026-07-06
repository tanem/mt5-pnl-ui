import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("../worker/client", () => ({ workerRunner: vi.fn() }));
vi.mock("../components/Chart", () => ({
  default: ({ label }: { label: string }) => <div data-testid="chart">{label}</div>,
}));

import { appStore } from "../store/app";
import Overview from "./Overview";
import { account, deal, makeSnapshot } from "../../tests/helpers/fixture";

beforeEach(() => appStore.getState().reset());

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
  const usd = screen.getByRole("region", { name: /usd/i });
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
  expect(screen.getByRole("region", { name: /usd/i })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /eur/i })).toBeInTheDocument();
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
