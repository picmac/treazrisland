import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

(globalThis as unknown as { React?: typeof React }).React = React;

if (!globalThis.URL.createObjectURL) {
  // Vitest JSDOM environment lacks this API; mock for emulator tests
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
}
