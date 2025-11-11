import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

type PixelInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(
  ({ className, invalid = false, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={clsx(
          "w-full rounded-pixel border px-3 py-2 text-sm text-foreground shadow-inner transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-night",
          invalid
            ? "border-[color-mix(in_srgb,_var(--color-danger)_70%,_transparent)] focus:border-danger focus:ring-danger"
            : "border-[var(--surface-outline-subtle)] focus:border-primary focus:ring-primary",
          "bg-surface-sunken placeholder:text-foreground/45",
          className
        )}
        {...props}
      />
    );
  }
);

PixelInput.displayName = "PixelInput";
