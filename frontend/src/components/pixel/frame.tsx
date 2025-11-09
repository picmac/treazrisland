import type { ReactNode } from "react";
import clsx from "clsx";

export type PixelFrameTone = "default" | "raised" | "sunken" | "translucent" | "highlight";

export interface PixelFrameProps {
  children: ReactNode;
  className?: string;
  tone?: PixelFrameTone;
}

export function PixelFrame({ children, className, tone = "raised" }: PixelFrameProps) {
  return (
    <div className={clsx("pixel-frame", className)} data-tone={tone}>
      {children}
    </div>
  );
}
