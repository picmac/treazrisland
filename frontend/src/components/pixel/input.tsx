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
          "w-full rounded-pixel border px-3 py-2 text-sm text-parchment shadow-inner transition focus:outline-none focus:ring-2 focus:ring-lagoon",
          invalid ? "border-red-500/70 focus:border-red-400" : "border-kelp/60 focus:border-lagoon",
          "bg-night/80 placeholder:text-parchment/40",
          className
        )}
        {...props}
      />
    );
  }
);

PixelInput.displayName = "PixelInput";
