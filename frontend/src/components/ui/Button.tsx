import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';

import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg';

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  href?: string;
} & ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement>;

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth,
  href,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    loading ? styles.loading : null,
    fullWidth ? styles.fullWidth : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const { target, rel, ...buttonProps } = rest;

  const content = (
    <>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{loading ? 'Working…' : children}</span>
    </>
  );

  if (href) {
    const isExternal = href.startsWith('http');
    const anchorRel = rel ?? (isExternal ? 'noreferrer' : undefined);
    const anchorTarget = target ?? (isExternal ? '_blank' : undefined);

    return isExternal ? (
      <a
        href={href}
        className={classes}
        target={anchorTarget}
        rel={anchorRel}
        aria-label={buttonProps['aria-label']}
      >
        {content}
      </a>
    ) : (
      <Link
        href={href}
        className={classes}
        target={anchorTarget}
        rel={anchorRel}
        aria-label={buttonProps['aria-label']}
      >
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={loading || buttonProps.disabled} {...buttonProps}>
      {content}
    </button>
  );
}
