import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger";

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-kelp text-night hover:bg-lagoon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lagoon",
  secondary:
    "bg-night border border-kelp text-kelp hover:bg-night/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kelp",
  danger:
    "bg-red-600 text-night hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
};

export const PixelButton = forwardRef<HTMLButtonElement, BaseButtonProps>(
  ({ className, variant = "primary", type = "button", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          "rounded-pixel px-4 py-2 text-xs font-semibold uppercase tracking-widest shadow-pixel transition disabled:opacity-60",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

PixelButton.displayName = "PixelButton";
