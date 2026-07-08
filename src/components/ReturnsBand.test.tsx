import { expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ReturnsBand from "./ReturnsBand";
import { groupReturnsByCurrency } from "../lib/derive/returns";
import { account, flow } from "../../tests/helpers/fixture";

// The spec's worked example: deposited 10,000; withdrawn 4,000; balance
// 9,000; floating 500 → profit 3,500, gain +35%.
function specExampleGroup() {
  const acct = account({ balance: 9000, equity: 9500 });
  const flows = [flow({ profit: 10000 }), flow({ profit: -4000 })];
  return groupReturnsByCurrency([acct], flows, [], null).get("USD")!;
}

test("renders the lifetime tiles", () => {
  render(<ReturnsBand currency="USD" group={specExampleGroup()} filtersActive={false} />);
  const band = screen.getByRole("region", { name: /usd account returns/i });
  expect(within(band).getByText("Deposited").nextSibling).toHaveTextContent("10,000.00 USD");
  expect(within(band).getByText("Withdrawn").nextSibling).toHaveTextContent("4,000.00 USD");
  expect(within(band).getByText("Floating").nextSibling).toHaveTextContent("+500.00 USD");
  expect(within(band).getByText("Profit").nextSibling).toHaveTextContent("+3,500.00 USD");
  expect(within(band).getByText("Gain").nextSibling).toHaveTextContent("+35.0%");
  expect(within(band).queryByText("Adjustments")).toBeNull(); // zero → hidden
  expect(within(band).queryByText("Transferred")).toBeNull(); // zero → hidden
  expect(within(band).queryByRole("table")).toBeNull(); // one account → no table
  expect(within(band).queryByText(/not affected by/i)).toBeNull();
});

test("shows the adjustments tile only when non-zero", () => {
  const acct = account({ balance: 1050, equity: 1050 });
  const group = groupReturnsByCurrency(
    [acct],
    [flow({ profit: 1000 }), flow({ type: 6, profit: 50 })],
    [],
    null,
  ).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  expect(screen.getByText("Adjustments").nextSibling).toHaveTextContent("+50.00 USD");
});

test("notes when filters are active", () => {
  render(<ReturnsBand currency="USD" group={specExampleGroup()} filtersActive={true} />);
  expect(
    screen.getByText("Not affected by date, symbol, or magic filters."),
  ).toBeInTheDocument();
});

test("multi-account groups render no table and one plain footnote", () => {
  const good = account({ login: 111, label: "Trend EA", balance: 1000, equity: 1000 });
  // 500 and 400 deposited but balances 900 → neither reconciles
  const bad1 = account({ login: 222, label: "Scalper EA", balance: 900, equity: 900 });
  const bad2 = account({ login: 333, label: "Grid EA", balance: 900, equity: 900 });
  const flows = [
    flow({ account: 111, profit: 1000 }),
    flow({ account: 222, profit: 500 }),
    flow({ account: 333, profit: 400 }),
  ];
  const group = groupReturnsByCurrency([good, bad1, bad2], flows, [], null).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  expect(screen.queryByRole("table")).toBeNull();
  // one plain footnote for the whole group, no asterisk convention
  expect(screen.getAllByText(/don't reconcile/)).toHaveLength(1);
  expect(
    screen.getByText(
      "Cash flows + trade P&L don't reconcile with the balance — snapshot deal history may be incomplete.",
    ),
  ).toBeInTheDocument();
});

test("a failing single-account group gets the footnote", () => {
  // 500 deposited but balance 900 and no deals → does not reconcile
  const acct = account({ login: 222, label: "Scalper EA", balance: 900, equity: 900 });
  const group = groupReturnsByCurrency([acct], [flow({ account: 222, profit: 500 })], [], null).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    screen.getByText(
      "Cash flows + trade P&L don't reconcile with the balance — snapshot deal history may be incomplete.",
    ),
  ).toBeInTheDocument();
});

test("gain renders n/a with neutral tone when nothing was deposited", () => {
  const group = groupReturnsByCurrency([account()], [], [], null).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  const gain = screen.getByText("Gain").nextSibling;
  expect(gain).toHaveTextContent("n/a");
});

test("shows the transferred tile only when internal transfers exist", () => {
  const accounts = [
    account({ login: 111, label: "Trend EA", balance: 700, equity: 700 }),
    account({ login: 222, label: "Scalper EA", balance: 300, equity: 300 }),
  ];
  const flows = [
    flow({ account: 111, ticket: 1, profit: 1000, time_msc: 0 }),
    flow({ account: 111, ticket: 2, profit: -300, time_msc: 2_000_000 }),
    flow({ account: 222, ticket: 3, profit: 300, time_msc: 2_030_000 }),
  ];
  const group = groupReturnsByCurrency(accounts, flows, [], null).get("USD")!;
  render(<ReturnsBand currency="USD" group={group} filtersActive={false} />);
  const band = screen.getByRole("region", { name: /usd account returns/i });
  expect(within(band).getByText("Transferred").nextSibling).toHaveTextContent("300.00 USD");
  expect(within(band).getAllByText("Deposited")[0]!.nextSibling).toHaveTextContent("1,000.00 USD");
});
