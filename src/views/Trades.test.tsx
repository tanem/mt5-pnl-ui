import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../worker/client", () => ({ workerRunner: vi.fn() }));

import { appStore } from "../store/app";
import Trades from "./Trades";
import { account, deal, makeSnapshot } from "../../tests/helpers/fixture";
import type { OpenPosition } from "../lib/snapshot/types";

function openPosition(overrides: Partial<OpenPosition> = {}): OpenPosition {
  return {
    account: 1234567,
    ticket: 1,
    identifier: 1,
    time: 1750000000,
    time_msc: 1750000000000,
    time_update: 1750000000,
    time_update_msc: 1750000000000,
    type: 0,
    reason: 3,
    magic: 100,
    volume: 0.1,
    price_open: 1.1,
    price_current: 1.2,
    sl: 0,
    tp: 0,
    profit: 42.5,
    swap: 0,
    symbol: "EURUSD",
    comment: "",
    external_id: "",
    ...overrides,
  };
}

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

test("numeric cells are right-aligned and no cell wraps", () => {
  render(<Trades />);
  const net = screen.getAllByTestId("cell-net")[0]!;
  expect(net.className).toContain("text-right");
  expect(net.className).toContain("whitespace-nowrap");
  const time = screen.getAllByTestId("cell-time")[0]!;
  expect(time.className).toContain("whitespace-nowrap");
  expect(time.className).not.toContain("text-right");
});

test("open-positions: Profit right-aligned, Magic left-aligned", async () => {
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [account({ login: 1234567, label: "Trend EA" })],
      closed_deals: [],
      open_positions: [openPosition({ magic: 100, profit: 42.5 })],
      cash_flows: [],
    }),
  });
  const user = userEvent.setup();
  render(<Trades />);
  await user.click(screen.getByRole("tab", { name: /open positions/i }));

  const profit = screen.getByText("42.50").closest("td")!;
  expect(profit.className).toContain("text-right");
  expect(profit.className).toContain("whitespace-nowrap");

  const magic = screen.getByText("100").closest("td")!;
  expect(magic.className).not.toContain("text-right");
  expect(magic.className).toContain("whitespace-nowrap");
});

test("cash-flows: Amount right-aligned, Comment left-aligned", async () => {
  const user = userEvent.setup();
  render(<Trades />);
  await user.click(screen.getByRole("tab", { name: /cash flows/i }));

  const amount = screen.getByText("500.00").closest("td")!;
  expect(amount.className).toContain("text-right");
  expect(amount.className).toContain("whitespace-nowrap");

  const comment = screen.getByText("Deposit").closest("td")!;
  expect(comment.className).not.toContain("text-right");
  expect(comment.className).toContain("whitespace-nowrap");
});
