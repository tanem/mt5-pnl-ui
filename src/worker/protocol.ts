import type { Stage } from "../lib/snapshot/errors";
import type { Snapshot } from "../lib/snapshot/types";

export interface WorkerRequest {
  id: number;
  bytes: ArrayBuffer;
  passphrase: string;
}

export type WorkerResponse =
  | { id: number; type: "progress"; stage: Stage }
  | { id: number; type: "result"; snapshot: Snapshot }
  | { id: number; type: "error"; stage: Stage | null; message: string };
