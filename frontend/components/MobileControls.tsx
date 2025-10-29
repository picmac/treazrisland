"use client";

import { useCallback } from "react";

export type VirtualKeyHandler = (key: string, pressed: boolean) => void;

type MobileControlsProps = {
  onVirtualKey?: VirtualKeyHandler;
};

const DPAD_KEYS = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight"
};

const ACTION_KEYS = {
  primary: "KeyX",
  secondary: "KeyZ",
  tertiary: "KeyA",
  quaternary: "KeyS"
};

const META_KEYS = {
  start: "Enter",
  select: "ShiftRight"
};

function usePointerHandlers(handler?: VirtualKeyHandler) {
  return useCallback(
    (key: string) => ({
      onPointerDown: () => handler?.(key, true),
      onPointerUp: () => handler?.(key, false),
      onPointerLeave: () => handler?.(key, false)
    }),
    [handler]
  );
}

export default function MobileControls({ onVirtualKey }: MobileControlsProps) {
  const bind = usePointerHandlers(onVirtualKey);

  return (
    <div className="md:hidden">
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 p-3 xs:p-4">
        <div className="flex w-full items-center justify-between gap-4 xs:gap-6">
          <div className="pointer-events-auto grid h-32 w-32 grid-cols-3 grid-rows-3 place-items-center rounded-pixel border border-ink/60 bg-night/80 p-2 shadow-pixel xs:h-40 xs:w-40">
            <button
              aria-label="Up"
              className="pixel-button-secondary col-start-2 row-start-1 h-10 w-10 xs:h-12 xs:w-12"
              {...bind(DPAD_KEYS.up)}
            >
              ▲
            </button>
            <button
              aria-label="Left"
              className="pixel-button-secondary col-start-1 row-start-2 h-10 w-10 xs:h-12 xs:w-12"
              {...bind(DPAD_KEYS.left)}
            >
              ◀
            </button>
            <button
              aria-label="Right"
              className="pixel-button-secondary col-start-3 row-start-2 h-10 w-10 xs:h-12 xs:w-12"
              {...bind(DPAD_KEYS.right)}
            >
              ▶
            </button>
            <button
              aria-label="Down"
              className="pixel-button-secondary col-start-2 row-start-3 h-10 w-10 xs:h-12 xs:w-12"
              {...bind(DPAD_KEYS.down)}
            >
              ▼
            </button>
          </div>
          <div className="pointer-events-auto grid h-36 w-36 grid-cols-2 grid-rows-2 items-center justify-items-center gap-3 rounded-pixel border border-ink/60 bg-night/80 p-3 shadow-pixel xs:h-44 xs:w-44 xs:gap-4 xs:p-4">
            <button aria-label="Primary" className="pixel-button h-12 w-12 xs:h-14 xs:w-14" {...bind(ACTION_KEYS.primary)}>
              A
            </button>
            <button aria-label="Secondary" className="pixel-button h-12 w-12 xs:h-14 xs:w-14" {...bind(ACTION_KEYS.secondary)}>
              B
            </button>
            <button aria-label="Tertiary" className="pixel-button h-12 w-12 xs:h-14 xs:w-14" {...bind(ACTION_KEYS.tertiary)}>
              X
            </button>
            <button aria-label="Quaternary" className="pixel-button h-12 w-12 xs:h-14 xs:w-14" {...bind(ACTION_KEYS.quaternary)}>
              Y
            </button>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center justify-center gap-4 self-center rounded-pixel border border-ink/60 bg-night/80 px-4 py-2 shadow-pixel xs:gap-6 xs:px-6 xs:py-3">
          <button aria-label="Select" className="pixel-button-secondary px-4 xs:px-6" {...bind(META_KEYS.select)}>
            Select
          </button>
          <button aria-label="Start" className="pixel-button px-4 xs:px-6" {...bind(META_KEYS.start)}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
