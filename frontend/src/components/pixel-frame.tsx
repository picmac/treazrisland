import type { ReactNode } from "react";
import clsx from "clsx";

interface PixelFrameProps {
  children: ReactNode;
  className?: string;
}

export function PixelFrame({ children, className }: PixelFrameProps) {
  return <div className={clsx("pixel-frame", className)}>{children}</div>;
}
