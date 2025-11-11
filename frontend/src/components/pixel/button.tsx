import { cloneElement, forwardRef, isValidElement, type ButtonHTMLAttributes, type ReactElement } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  asChild?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-night hover:bg-primary-strong focus-visible:ring-primary border border-[color-mix(in_srgb,_var(--color-primary)_60%,_transparent)]",
  secondary:
    "bg-surface-translucent border border-[var(--surface-outline-subtle)] text-primary hover:bg-surface-raised focus-visible:ring-primary",
  danger:
    "bg-danger text-night hover:bg-[color-mix(in_srgb,_var(--color-danger)_78%,_transparent)] focus-visible:ring-danger border border-[color-mix(in_srgb,_var(--color-danger)_70%,_transparent)]",
  ghost:
    "bg-transparent border border-[var(--surface-outline-subtle)] text-foreground hover:bg-surface-translucent focus-visible:ring-primary"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-4 py-2 text-xs",
  lg: "px-5 py-3 text-sm"
};

export const PixelButton = forwardRef<HTMLButtonElement, BaseButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth = false,
      type = "button",
      asChild = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = clsx(
      "inline-flex items-center justify-center gap-2 rounded-pixel font-semibold uppercase tracking-widest shadow-pixel transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && "w-full",
      className
    );

    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{ className?: string }>;
      return cloneElement(child, {
        className: clsx(baseClasses, child.props.className),
        ...props
      });
    }

    return (
      <button ref={ref} type={type} className={baseClasses} {...props}>
        {children}
      </button>
    );
  }
);

PixelButton.displayName = "PixelButton";
