import type { HTMLAttributes, ReactNode } from 'react';

import styles from './Alert.module.css';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  dense?: boolean;
  role?: 'status' | 'alert';
} & HTMLAttributes<HTMLDivElement>;

export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  dense = false,
  role = 'status',
  className,
  ...rest
}: AlertProps) {
  const classes = [styles.alert, styles[tone], dense ? styles.dense : null, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role={role} {...rest}>
      <div className={styles.body}>
        {title ? <p className={styles.title}>{title}</p> : null}
        {children ? <p className={styles.description}>{children}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
