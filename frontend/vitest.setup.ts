import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

(globalThis as unknown as { React?: typeof React }).React = React;

if (!globalThis.URL.createObjectURL) {
  // Vitest JSDOM environment lacks this API; mock for emulator tests
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
}

// axe-core uses canvas APIs to compute color contrast, but JSDOM doesn't ship a
// real Canvas implementation. Mock the bits we need so accessibility tests can
// run without logging noisy "getContext not implemented" errors to stderr.
const mockCanvasContext = {
  arc: vi.fn(),
  arcTo: vi.fn(),
  beginPath: vi.fn(),
  bezierCurveTo: vi.fn(),
  clearRect: vi.fn(),
  clip: vi.fn(),
  closePath: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createPattern: vi.fn(() => ({})),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  drawImage: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray() })),
  isPointInPath: vi.fn(),
  isPointInStroke: vi.fn(),
  lineTo: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  moveTo: vi.fn(),
  putImageData: vi.fn(),
  quadraticCurveTo: vi.fn(),
  rect: vi.fn(),
  restore: vi.fn(),
  rotate: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  strokeText: vi.fn(),
  transform: vi.fn(),
  translate: vi.fn(),
};

if (typeof globalThis.HTMLCanvasElement === "undefined") {
  class MockCanvasElement extends (globalThis.HTMLElement ?? class {}) {}

  Object.defineProperty(MockCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => mockCanvasContext as unknown as CanvasRenderingContext2D),
  });

  Object.defineProperty(MockCanvasElement.prototype, "toDataURL", {
    configurable: true,
    value: vi.fn(() => "data:image/png;base64,mock"),
  });

  globalThis.HTMLCanvasElement = MockCanvasElement as unknown as typeof HTMLCanvasElement;
} else {
  const canvasPrototype = globalThis.HTMLCanvasElement.prototype;

  Object.defineProperty(canvasPrototype, "getContext", {
    configurable: true,
    value: vi.fn(() => mockCanvasContext as unknown as CanvasRenderingContext2D),
  });

  if (!canvasPrototype.toDataURL) {
    Object.defineProperty(canvasPrototype, "toDataURL", {
      configurable: true,
      value: vi.fn(() => "data:image/png;base64,mock"),
    });
  }
}

const originalGetComputedStyle = globalThis.getComputedStyle?.bind(globalThis);
if (originalGetComputedStyle) {
  globalThis.getComputedStyle = ((elt: Element, pseudoElt?: string | null) => {
    if (pseudoElt) {
      return originalGetComputedStyle(elt);
    }

    return originalGetComputedStyle(elt, pseudoElt);
  }) as typeof getComputedStyle;
}
