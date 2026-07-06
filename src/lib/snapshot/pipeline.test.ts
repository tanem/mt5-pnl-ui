import { describe, expect, test } from "vitest";
import { gzipSync } from "node:zlib";
import { Encrypter } from "age-encryption";
import { decryptSnapshot } from "./pipeline";
import { SnapshotError } from "./errors";
import { encryptSnapshot, makeSnapshot } from "../../../tests/helpers/fixture";

const PASS = "test-passphrase";

async function encryptRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const enc = new Encrypter();
  enc.setPassphrase(PASS);
  enc.setScryptWorkFactor(10);
  return enc.encrypt(bytes);
}

describe("decryptSnapshot", () => {
  test("round-trips an encrypted snapshot", async () => {
    const snap = makeSnapshot();
    const bytes = await encryptSnapshot(snap, PASS);
    await expect(decryptSnapshot(bytes, PASS)).resolves.toEqual(snap);
  });

  test("wrong passphrase → decrypt-stage error", async () => {
    const bytes = await encryptSnapshot(makeSnapshot(), PASS);
    const err = await decryptSnapshot(bytes, "wrong").catch((e) => e);
    expect(err).toBeInstanceOf(SnapshotError);
    expect((err as SnapshotError).stage).toBe("decrypt");
    expect((err as SnapshotError).message).toMatch(/passphrase/i);
  });

  test("not an age file → decrypt-stage error naming the format", async () => {
    const err = await decryptSnapshot(
      new TextEncoder().encode("plain text"),
      PASS,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(SnapshotError);
    expect((err as SnapshotError).stage).toBe("decrypt");
    expect((err as SnapshotError).message).toMatch(/age/i);
  });

  test("decrypts but is not gzip → gunzip-stage error", async () => {
    const bytes = await encryptRaw(new TextEncoder().encode("not gzip"));
    const err = await decryptSnapshot(bytes, PASS).catch((e) => e);
    expect((err as SnapshotError).stage).toBe("gunzip");
  });

  test("gunzips but is not JSON → parse-stage error", async () => {
    const bytes = await encryptRaw(new Uint8Array(gzipSync("{nope")));
    const err = await decryptSnapshot(bytes, PASS).catch((e) => e);
    expect((err as SnapshotError).stage).toBe("parse");
  });

  test("unsupported schema version → schema-stage error", async () => {
    const bytes = await encryptSnapshot(
      makeSnapshot({ schema_version: "2.0" }),
      PASS,
    );
    const err = await decryptSnapshot(bytes, PASS).catch((e) => e);
    expect((err as SnapshotError).stage).toBe("schema");
  });
});
