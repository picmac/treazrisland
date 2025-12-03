import type { HTMLAttributes, ReactNode } from 'react';

import styles from './StatusPill.module.css';

type StatusTone = 'info' | 'success' | 'warning' | 'danger';

type StatusPillProps = {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

export function StatusPill({ tone = 'info', icon, children, className, ...rest }: StatusPillProps) {
  const classes = [styles.pill, styles[tone], className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...rest}>
      {icon}
      <span>{children}</span>
    </span>
  );
}
