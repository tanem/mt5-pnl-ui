import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../worker/client", () => ({ workerRunner: vi.fn() }));

import { appStore } from "../store/app";
import CalendarView, { buildMonthCells } from "./CalendarView";
import { deal, makeSnapshot } from "../../tests/helpers/fixture";

beforeEach(() => appStore.getState().reset());

test("buildMonthCells pads to Monday-start whole weeks", () => {
  // June 2025: the 1st is a Sunday → 6 leading nulls; 30 days; 6 trailing nulls
  const cells = buildMonthCells(2025, 5);
  expect(cells).toHaveLength(42);
  expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
  expect(cells[6]).toBe("2025-06-01");
  expect(cells[35]).toBe("2025-06-30");
});

test("renders day P&L, trade count, and the month total", () => {
  const t = Date.UTC(2025, 5, 12, 10) / 1000; // 2025-06-12
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({
      closed_deals: [
        deal({ time: t, profit: 10, commission: 0 }),
        deal({ time: t, profit: -4, commission: 0 }),
      ],
    }),
  });
  render(<CalendarView />);
  const cell = screen.getByRole("gridcell", { name: /12/ });
  expect(within(cell).getByText("+6.00")).toBeInTheDocument();
  expect(within(cell).getByText("2 trades")).toBeInTheDocument();
  expect(screen.getByText(/month total/i)).toHaveTextContent("+6.00 USD");
});

test("month navigation moves to the previous month", async () => {
  const t = Date.UTC(2025, 5, 12, 10) / 1000;
  appStore.setState({
    status: "ready",
    snapshot: makeSnapshot({ closed_deals: [deal({ time: t })] }),
  });
  const user = userEvent.setup();
  render(<CalendarView />);
  expect(screen.getByText("June 2025")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /previous month/i }));
  expect(screen.getByText("May 2025")).toBeInTheDocument();
});
