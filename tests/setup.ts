import "@testing-library/jest-dom/vitest";

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
