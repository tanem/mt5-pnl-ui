import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";

vi.mock("./worker/client", () => ({ workerRunner: vi.fn() }));

import { appStore } from "./store/app";
import App from "./App";
import { makeSnapshot } from "../tests/helpers/fixture";

test("shows LoadScreen when no snapshot is loaded", () => {
  appStore.getState().reset();
  render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
  expect(screen.getByText(/nothing leaves this machine/i)).toBeInTheDocument();
});

test("shows the shell once a snapshot is in the store", () => {
  appStore.setState({ status: "ready", snapshot: makeSnapshot(), fileName: "mt5.json.gz.age" });
  render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
  expect(screen.getByRole("navigation")).toBeInTheDocument();
  expect(screen.getByText("mt5.json.gz.age")).toBeInTheDocument();
});
