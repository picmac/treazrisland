import type { ReactNode } from "react";
import clsx from "clsx";

type NoticeTone = "info" | "success" | "error" | "warning";

type PixelNoticeProps = {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
};

const toneClasses: Record<NoticeTone, string> = {
  info: "border-[color-mix(in_srgb,_var(--color-info)_70%,_transparent)] text-[var(--color-info)]",
  success: "border-[color-mix(in_srgb,_var(--color-success)_70%,_transparent)] text-[var(--color-success)]",
  error: "border-[color-mix(in_srgb,_var(--color-danger)_70%,_transparent)] text-[var(--color-danger)]",
  warning: "border-[color-mix(in_srgb,_var(--color-warning)_75%,_transparent)] text-[var(--color-warning)]"
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
