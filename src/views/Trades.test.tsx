import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../worker/client", () => ({ workerRunner: vi.fn() }));

import { appStore } from "../store/app";
import Trades from "./Trades";
import { account, deal, makeSnapshot } from "../../tests/helpers/fixture";

beforeEach(() => {
  appStore.getState().reset();
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [account({ login: 1234567, label: "Trend EA" })],
      closed_deals: [
        deal({ ticket: 1, symbol: "EURUSD", profit: 10, time: 1750000000 }),
        deal({ ticket: 2, symbol: "XAUUSD", profit: -5, time: 1750100000 }),
      ],
      open_positions: [],
      cash_flows: [
        deal({ ticket: 9, type: 2, profit: 500, symbol: "", comment: "Deposit" }),
      ],
    }),
  });
});

test("renders closed deals with net column and account label", () => {
  render(<Trades />);
  expect(screen.getByRole("tab", { name: /closed deals/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByText("EURUSD")).toBeInTheDocument();
  expect(screen.getByText("XAUUSD")).toBeInTheDocument();
  expect(screen.getAllByText("Trend EA").length).toBeGreaterThan(0);
});

test("clicking a column header sorts", async () => {
  const user = userEvent.setup();
  render(<Trades />);
  await user.click(screen.getByRole("button", { name: /^net$/i }));
  const cells = screen.getAllByTestId("cell-symbol").map((c) => c.textContent);
  expect(cells).toEqual(["XAUUSD", "EURUSD"]); // ascending: -5.50 first
});

test("cash-flows tab shows balance-family records", async () => {
  const user = userEvent.setup();
  render(<Trades />);
  await user.click(screen.getByRole("tab", { name: /cash flows/i }));
  expect(screen.getByText("Deposit")).toBeInTheDocument();
  expect(screen.getByText("500.00")).toBeInTheDocument();
});

test("empty open positions tab says so", async () => {
  const user = userEvent.setup();
  render(<Trades />);
  await user.click(screen.getByRole("tab", { name: /open positions/i }));
  expect(screen.getByText(/no open positions/i)).toBeInTheDocument();
});
