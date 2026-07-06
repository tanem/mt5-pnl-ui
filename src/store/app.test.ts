import { describe, expect, test } from "vitest";
import { createAppStore } from "./app";
import type { PipelineRunner } from "../worker/client";
import { SnapshotError } from "../lib/snapshot/errors";
import { makeSnapshot } from "../../tests/helpers/fixture";

const snap = makeSnapshot();

const okRunner: PipelineRunner = async (_b, _p, onStage) => {
  onStage("decrypt");
  return snap;
};

const failRunner: PipelineRunner = async () => {
  throw new SnapshotError("decrypt", "Decryption failed — wrong passphrase for this snapshot.");
};

describe("app store", () => {
  test("successful load: working → ready with snapshot and file name", async () => {
    const store = createAppStore(okRunner);
    const ok = await store
      .getState()
      .load(new ArrayBuffer(0), "pw", "mt5.json.gz.age");
    expect(ok).toBe(true);
    const s = store.getState();
    expect(s.status).toBe("ready");
    expect(s.snapshot).toEqual(snap);
    expect(s.fileName).toBe("mt5.json.gz.age");
    expect(s.error).toBeNull();
  });

  test("failed load: error message and stage exposed, snapshot stays null", async () => {
    const store = createAppStore(failRunner);
    const ok = await store.getState().load(new ArrayBuffer(0), "pw", "f.age");
    expect(ok).toBe(false);
    const s = store.getState();
    expect(s.status).toBe("error");
    expect(s.stage).toBe("decrypt");
    expect(s.error).toMatch(/passphrase/i);
    expect(s.snapshot).toBeNull();
  });

  test("setFilters patches, reset returns to idle", async () => {
    const store = createAppStore(okRunner);
    store.getState().setFilters({ symbol: "EURUSD" });
    expect(store.getState().filters.symbol).toBe("EURUSD");
    await store.getState().load(new ArrayBuffer(0), "pw", "f.age");
    store.getState().reset();
    expect(store.getState().status).toBe("idle");
    expect(store.getState().snapshot).toBeNull();
  });
});
