import type { ReactNode } from "react";
import clsx from "clsx";

type NoticeTone = "info" | "success" | "error";

type PixelNoticeProps = {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
};

const toneClasses: Record<NoticeTone, string> = {
  info: "border-lagoon/50 text-lagoon",
  success: "border-kelp/60 text-kelp",
  error: "border-red-500/60 text-red-200"
};

export function PixelNotice({ tone = "info", children, className }: PixelNoticeProps) {
  return (
    <p
      className={clsx(
        "rounded-pixel border px-3 py-2 text-xs tracking-wide",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </p>
  );
}
