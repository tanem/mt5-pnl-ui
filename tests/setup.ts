import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// vitest.config's test.globals is off, so @testing-library/react's automatic
// afterEach(cleanup) never registers; unmount explicitly between tests.
afterEach(cleanup);

// jsdom lacks DecompressionStream; Node ships it.
if (typeof globalThis.DecompressionStream === "undefined") {
  const { DecompressionStream } = await import("node:stream/web");
  globalThis.DecompressionStream = DecompressionStream as never;
}

// jsdom's Blob has arrayBuffer() but not stream(); wrap the former to provide the latter.
if (typeof globalThis.Blob.prototype.stream === "undefined") {
  globalThis.Blob.prototype.stream = function (this: Blob) {
    const blob = this;
    return new ReadableStream({
      async start(controller) {
        controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
        controller.close();
      },
    }) as never;
  };
}

// jsdom does no layout, so every element reports 0x0 and lacks ResizeObserver.
// @tanstack/react-virtual measures its scroll container on mount and treats a
// 0-sized rect as "not yet measured", which permanently suppresses virtual
// rows (its initialRect fallback is overridden by that same 0x0 reading).
// Stub non-zero layout sizes so virtualised tables can render in tests.
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  value: 800,
});
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  value: 600,
});
