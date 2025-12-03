import type { HTMLAttributes, ReactNode } from 'react';

import styles from './Card.module.css';

type CardTone = 'default' | 'success' | 'warning' | 'danger';

type CardProps = {
  as?: 'div' | 'section' | 'article';
  eyebrow?: string;
  title?: string;
  description?: string;
  tone?: CardTone;
  glow?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
} & HTMLAttributes<HTMLElement>;

export function Card({
  eyebrow,
  title,
  description,
  tone = 'default',
  glow = false,
  actions,
  className,
  children,
  as = 'section',
  ...rest
}: CardProps) {
  const Component = as;
  const toneClass =
    tone === 'success'
      ? styles.toneSuccess
      : tone === 'warning'
        ? styles.toneWarning
        : tone === 'danger'
          ? styles.toneDanger
          : null;

  const classes = [styles.card, glow ? styles.glow : null, toneClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {(eyebrow || title || actions) && (
        <header className={styles.header}>
          <div>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            {title ? <h2 className={styles.title}>{title}</h2> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions}
        </header>
      )}
      {children}
    </Component>
  );
}
