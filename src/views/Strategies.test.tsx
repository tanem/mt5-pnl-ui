import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../worker/client", () => ({ workerRunner: vi.fn() }));
vi.mock("../components/Chart", () => ({
  default: ({ label }: { label: string }) => <div data-testid="chart">{label}</div>,
}));

import { appStore } from "../store/app";
import Strategies from "./Strategies";
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
        deal({ account: 111, magic: 100, profit: 10, commission: 0 }),
        deal({ account: 111, magic: 100, profit: -4, commission: 0 }),
        deal({ account: 222, magic: 200, profit: 7, commission: 0 }),
      ],
    }),
  });
});

test("groups by account label by default with per-row stats", () => {
  render(<Strategies />);
  const trend = screen.getByRole("row", { name: /trend ea/i });
  expect(within(trend).getByText("+6.00 USD")).toBeInTheDocument();
  expect(within(trend).getByText("50.0%")).toBeInTheDocument();
  const scalper = screen.getByRole("row", { name: /scalper ea/i });
  expect(within(scalper).getByText("+7.00 USD")).toBeInTheDocument();
});

test("toggling to magic regroups", async () => {
  const user = userEvent.setup();
  render(<Strategies />);
  await user.click(screen.getByRole("radio", { name: /magic/i }));
  expect(screen.getByRole("row", { name: /^100/ })).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /^200/ })).toBeInTheDocument();
});
