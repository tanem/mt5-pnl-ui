import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../worker/client", () => ({ workerRunner: vi.fn() }));

import { appStore } from "../store/app";
import FilterBar from "./FilterBar";
import { account, deal, makeSnapshot } from "../../tests/helpers/fixture";

beforeEach(() => {
  appStore.getState().reset();
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      accounts: [
        account({ login: 111, label: "Trend EA" }),
        account({ login: 222, label: "Scalper EA" }),
      ],
      closed_deals: [
        deal({ account: 111, symbol: "EURUSD" }),
        deal({ account: 222, symbol: "XAUUSD" }),
      ],
    }),
  });
});

test("toggling an account narrows the filter to the remaining logins", async () => {
  const user = userEvent.setup();
  render(<FilterBar />);
  await user.click(screen.getByRole("checkbox", { name: /scalper ea/i }));
  expect(appStore.getState().filters.accounts).toEqual([111]);
  await user.click(screen.getByRole("checkbox", { name: /scalper ea/i }));
  expect(appStore.getState().filters.accounts).toBeNull(); // all on = no filter
});

test("date inputs set the UTC range filter", () => {
  // fireEvent.change: user-event cannot type reliably into <input type="date">
  render(<FilterBar />);
  fireEvent.change(screen.getByLabelText(/^from$/i), {
    target: { value: "2025-06-01" },
  });
  fireEvent.change(screen.getByLabelText(/^to$/i), {
    target: { value: "2025-06-30" },
  });
  expect(appStore.getState().filters.from).toBe("2025-06-01");
  expect(appStore.getState().filters.to).toBe("2025-06-30");
});

test("symbol select and magic input set exact filters, empty clears", async () => {
  const user = userEvent.setup();
  render(<FilterBar />);
  await user.selectOptions(screen.getByLabelText(/symbol/i), "EURUSD");
  expect(appStore.getState().filters.symbol).toBe("EURUSD");
  await user.selectOptions(screen.getByLabelText(/symbol/i), "");
  expect(appStore.getState().filters.symbol).toBeNull();
  await user.type(screen.getByLabelText(/magic/i), "100");
  expect(appStore.getState().filters.magic).toBe(100);
  await user.clear(screen.getByLabelText(/magic/i));
  expect(appStore.getState().filters.magic).toBeNull();
});
