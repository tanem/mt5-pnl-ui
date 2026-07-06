import { SnapshotError } from "./errors";

/** Vendored schema version this build supports (schema/snapshot.schema.json). */
export const SUPPORTED_SCHEMA = { major: 1, minor: 0 } as const;

const supported = `${SUPPORTED_SCHEMA.major}.${SUPPORTED_SCHEMA.minor}`;

/** Accept the same major and any minor at or below ours; reject otherwise. */
export function assertSupportedSchema(version: string): void {
  const m = /^(\d+)\.(\d+)$/.exec(version);
  if (!m) {
    throw new SnapshotError(
      "schema",
      `Snapshot schema version ${JSON.stringify(version)} is not a major.minor string; this build supports ${supported}.`,
    );
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major !== SUPPORTED_SCHEMA.major || minor > SUPPORTED_SCHEMA.minor) {
    throw new SnapshotError(
      "schema",
      `Snapshot schema ${version} is not supported by this build (supports ${SUPPORTED_SCHEMA.major}.x up to ${supported}). Update mt5-pnl-ui or re-export with a matching mt5-pnl-exporter.`,
    );
  }
}
