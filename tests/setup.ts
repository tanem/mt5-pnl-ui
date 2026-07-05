import "@testing-library/jest-dom/vitest";

// jsdom lacks DecompressionStream; Node ships it.
if (typeof globalThis.DecompressionStream === "undefined") {
  const { DecompressionStream } = await import("node:stream/web");
  globalThis.DecompressionStream = DecompressionStream as never;
}
