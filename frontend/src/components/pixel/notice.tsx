import type { ReactNode } from "react";
import clsx from "clsx";

type NoticeTone = "info" | "success" | "error" | "warning";

type PixelNoticeProps = {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
};

const toneClasses: Record<NoticeTone, string> = {
  info: "border-[color:color-mix(in srgb, var(--color-info) 70%, transparent)] text-[color:var(--color-info)]",
  success: "border-[color:color-mix(in srgb, var(--color-success) 70%, transparent)] text-[color:var(--color-success)]",
  error: "border-[color:color-mix(in srgb, var(--color-danger) 70%, transparent)] text-[color:var(--color-danger)]",
  warning: "border-[color:color-mix(in srgb, var(--color-warning) 75%, transparent)] text-[color:var(--color-warning)]"
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
