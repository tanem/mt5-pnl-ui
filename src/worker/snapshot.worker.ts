import { SnapshotError } from "../lib/snapshot/errors";
import { decryptSnapshot } from "../lib/snapshot/pipeline";
import type { WorkerRequest, WorkerResponse } from "./protocol";

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const { id, bytes, passphrase } = ev.data;
  const post = (msg: WorkerResponse) => self.postMessage(msg);
  try {
    post({ id, type: "progress", stage: "decrypt" });
    const snapshot = await decryptSnapshot(new Uint8Array(bytes), passphrase);
    post({ id, type: "result", snapshot });
  } catch (e) {
    if (e instanceof SnapshotError) {
      post({ id, type: "error", stage: e.stage, message: e.message });
    } else {
      post({
        id,
        type: "error",
        stage: null,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
};
