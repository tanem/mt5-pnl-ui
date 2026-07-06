import { beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnapshotError } from "../lib/snapshot/errors";
import { makeSnapshot } from "../../tests/helpers/fixture";

vi.mock("../worker/client", () => ({
  workerRunner: async (_bytes: ArrayBuffer, passphrase: string) => {
    if (passphrase === "correct") return makeSnapshot();
    throw new SnapshotError(
      "decrypt",
      "Decryption failed — wrong passphrase for this snapshot.",
    );
  },
}));

import { appStore } from "../store/app";
import LoadScreen from "./LoadScreen";

beforeEach(() => appStore.getState().reset());

function agefile() {
  return new File([new Uint8Array([1, 2, 3])], "mt5.json.gz.age");
}

test("picker + correct passphrase loads the snapshot into the store", async () => {
  const user = userEvent.setup();
  render(<LoadScreen />);
  await user.upload(screen.getByLabelText(/snapshot file/i), agefile());
  await user.type(screen.getByLabelText(/passphrase/i), "correct");
  await user.click(screen.getByRole("button", { name: /unlock/i }));
  await vi.waitFor(() => expect(appStore.getState().status).toBe("ready"));
  expect(appStore.getState().fileName).toBe("mt5.json.gz.age");
});

test("wrong passphrase shows the decrypt one-liner and clears the field", async () => {
  const user = userEvent.setup();
  render(<LoadScreen />);
  await user.upload(screen.getByLabelText(/snapshot file/i), agefile());
  await user.type(screen.getByLabelText(/passphrase/i), "nope");
  await user.click(screen.getByRole("button", { name: /unlock/i }));
  expect(await screen.findByText(/wrong passphrase/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/passphrase/i)).toHaveValue("");
});

test("unlock is disabled until both file and passphrase are present", async () => {
  const user = userEvent.setup();
  render(<LoadScreen />);
  const unlock = screen.getByRole("button", { name: /unlock/i });
  expect(unlock).toBeDisabled();
  await user.type(screen.getByLabelText(/passphrase/i), "x");
  expect(unlock).toBeDisabled(); // still no file
  await user.upload(screen.getByLabelText(/snapshot file/i), agefile());
  expect(unlock).toBeEnabled();
});
