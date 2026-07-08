import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { SnapshotError, type Stage } from "../lib/snapshot/errors";
import type { Snapshot } from "../lib/snapshot/types";
import { EMPTY_FILTERS, reconcileFilters, type Filters } from "../lib/derive/filters";
import { workerRunner, type PipelineRunner } from "../worker/client";

export type LoadStatus = "idle" | "working" | "ready" | "error";

export interface AppState {
  status: LoadStatus;
  stage: Stage | null;
  error: string | null;
  fileName: string | null;
  snapshot: Snapshot | null;
  filters: Filters;
  load(bytes: ArrayBuffer, passphrase: string, fileName: string): Promise<boolean>;
  setFilters(patch: Partial<Filters>): void;
  reset(): void;
}

export function createAppStore(run: PipelineRunner): StoreApi<AppState> {
  return createStore<AppState>()((set) => ({
    status: "idle",
    stage: null,
    error: null,
    fileName: null,
    snapshot: null,
    filters: EMPTY_FILTERS,

    async load(bytes, passphrase, fileName) {
      set({ status: "working", stage: "read", error: null });
      try {
        const snapshot = await run(bytes, passphrase, (stage) => set({ stage }));
        set({ status: "ready", snapshot, fileName, stage: null, error: null });
        return true;
      } catch (e) {
        set({
          status: "error",
          snapshot: null,
          stage: e instanceof SnapshotError ? e.stage : null,
          error: e instanceof Error ? e.message : String(e),
        });
        return false;
      }
    },

    setFilters(patch) {
      set((s) => {
        // An account change reconciles the symbol/magic selections with
        // the new scope — see reconcileFilters.
        const next =
          patch.accounts !== undefined && s.snapshot
            ? { ...patch, ...reconcileFilters(s.snapshot.closed_deals, s.filters, patch.accounts) }
            : patch;
        return { filters: { ...s.filters, ...next } };
      });
    },

    reset() {
      set({
        status: "idle",
        stage: null,
        error: null,
        fileName: null,
        snapshot: null,
        filters: EMPTY_FILTERS,
      });
    },
  }));
}

export const appStore = createAppStore(workerRunner);

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(appStore, selector);
}
