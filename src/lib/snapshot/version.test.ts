import { describe, expect, test } from "vitest";
import { assertSupportedSchema, SUPPORTED_SCHEMA } from "./version";
import { SnapshotError } from "./errors";

describe("assertSupportedSchema", () => {
  test("accepts same major, minor at or below supported", () => {
    expect(() => assertSupportedSchema("1.0")).not.toThrow();
  });

  test("rejects higher minor with both versions in the message", () => {
    const call = () => assertSupportedSchema("1.99");
    expect(call).toThrowError(SnapshotError);
    expect(call).toThrowError(/1\.99/);
    expect(call).toThrowError(new RegExp(`1\\.${SUPPORTED_SCHEMA.minor}`));
  });

  test("rejects different major", () => {
    expect(() => assertSupportedSchema("2.0")).toThrowError(SnapshotError);
    expect(() => assertSupportedSchema("0.9")).toThrowError(SnapshotError);
  });

  test("rejects malformed version strings", () => {
    expect(() => assertSupportedSchema("banana")).toThrowError(SnapshotError);
    expect(() => assertSupportedSchema("")).toThrowError(SnapshotError);
  });
});
