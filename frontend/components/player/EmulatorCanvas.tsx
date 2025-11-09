"use client";

import { forwardRef } from "react";

type EmulatorCanvasProps = {
  status: "idle" | "loading" | "ready" | "error";
  error?: string | null;
};

const EmulatorCanvas = forwardRef<HTMLDivElement, EmulatorCanvasProps>(
  ({ status, error }, ref) => (
    <div
      ref={ref}
      className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-pixel border border-ink/80 bg-night"
    >
      {status === "loading" && (
        <span className="text-sm uppercase tracking-widest text-parchment/70">
          Preparing emulator…
        </span>
      )}
      {status === "error" && error && (
        <span className="text-sm text-coral">{error}</span>
      )}
      <canvas className="h-full w-full" data-testid="emulator-canvas" />
    </div>
  )
);

EmulatorCanvas.displayName = "EmulatorCanvas";

export default EmulatorCanvas;

