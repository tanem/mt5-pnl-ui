export type Stage = "read" | "decrypt" | "gunzip" | "parse" | "schema";

/** A pipeline failure with a user-facing, stage-specific message. */
export class SnapshotError extends Error {
  readonly stage: Stage;

  constructor(stage: Stage, message: string) {
    super(message);
    this.name = "SnapshotError";
    this.stage = stage;
  }
}
