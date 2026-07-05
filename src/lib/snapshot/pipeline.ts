import { Decrypter } from "age-encryption";
import { SnapshotError } from "./errors";
import type { Snapshot } from "./types";
import { assertSupportedSchema } from "./version";

async function gunzip(bytes: Uint8Array): Promise<string> {
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  } catch {
    throw new SnapshotError(
      "gunzip",
      "Decrypted, but the contents are not gzip. Is this file from mt5-pnl-exporter?",
    );
  }
}

/** age decrypt → gunzip → JSON.parse → schema gate. Mirrors the CLI's read path. */
export async function decryptSnapshot(
  bytes: Uint8Array,
  passphrase: string,
): Promise<Snapshot> {
  let plain: Uint8Array;
  try {
    const dec = new Decrypter();
    dec.addPassphrase(passphrase);
    plain = await dec.decrypt(bytes, "uint8array");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/parse|header|intro|version line|format/i.test(msg)) {
      throw new SnapshotError(
        "decrypt",
        "This is not an age-encrypted file. Pick the snapshot.json.gz.age written by mt5-pnl-exporter.",
      );
    }
    throw new SnapshotError(
      "decrypt",
      "Decryption failed — wrong passphrase for this snapshot.",
    );
  }

  const text = await gunzip(plain);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SnapshotError("parse", "Decrypted contents are not valid JSON.");
  }

  const snap = data as Snapshot;
  if (typeof snap?.schema_version !== "string") {
    throw new SnapshotError(
      "schema",
      "Decrypted JSON has no schema_version — not an mt5-pnl-exporter snapshot.",
    );
  }
  assertSupportedSchema(snap.schema_version); // throws stage "schema"
  return snap;
}
