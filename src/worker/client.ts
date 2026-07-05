import { SnapshotError, type Stage } from "../lib/snapshot/errors";
import type { Snapshot } from "../lib/snapshot/types";
import type { WorkerResponse } from "./protocol";

export type PipelineRunner = (
  bytes: ArrayBuffer,
  passphrase: string,
  onStage: (s: Stage) => void,
) => Promise<Snapshot>;

interface Pending {
  resolve: (s: Snapshot) => void;
  reject: (e: Error) => void;
  onStage: (s: Stage) => void;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./snapshot.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === "progress") {
        p.onStage(msg.stage);
      } else if (msg.type === "result") {
        pending.delete(msg.id);
        p.resolve(msg.snapshot);
      } else {
        pending.delete(msg.id);
        p.reject(
          msg.stage
            ? new SnapshotError(msg.stage, msg.message)
            : new Error(msg.message),
        );
      }
    };
  }
  return worker;
}

/** Runs the decrypt pipeline in the worker; bytes are transferred, not copied. */
export const workerRunner: PipelineRunner = (bytes, passphrase, onStage) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, onStage });
    getWorker().postMessage({ id, bytes, passphrase }, [bytes]);
  });
