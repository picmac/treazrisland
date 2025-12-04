import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';

import { PIXELLAB_TOKENS } from '@/theme/tokens';
import styles from './layout.module.css';

type SpacingKey = keyof typeof PIXELLAB_TOKENS.spacing;

type BaseProps<T extends HTMLElement> = {
  as?: ElementType;
  gap?: SpacingKey | string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Omit<HTMLAttributes<T>, 'children'>;

function resolveGap(gap?: SpacingKey | string) {
  if (!gap) return undefined;
  return gap in PIXELLAB_TOKENS.spacing
    ? PIXELLAB_TOKENS.spacing[gap as SpacingKey]
    : (gap as string);
}

export function Stack<T extends HTMLElement = HTMLElement>({
  as = 'div',
  gap = 'md',
  className,
  style,
  align,
  justify,
  children,
  ...rest
}: BaseProps<T> & {
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
}) {
  const Component = as as ElementType;
  const gapValue = resolveGap(gap);
  const classes = [styles.stack, className].filter(Boolean).join(' ');

  return (
    <Component
      className={classes}
      style={{ gap: gapValue, alignItems: align, justifyContent: justify, ...style }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function Cluster<T extends HTMLElement = HTMLElement>({
  as = 'div',
  gap = 'sm',
  align = 'center',
  justify,
  className,
  style,
  children,
  ...rest
}: BaseProps<T> & {
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
}) {
  const Component = as as ElementType;
  const gapValue = resolveGap(gap);
  const classes = [styles.cluster, className].filter(Boolean).join(' ');

  return (
    <Component
      className={classes}
      style={{ gap: gapValue, alignItems: align, justifyContent: justify, ...style }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function Grid<T extends HTMLElement = HTMLElement>({
  as = 'div',
  gap = 'md',
  minColumnWidth = '260px',
  className,
  style,
  children,
  columns,
  ...rest
}: BaseProps<T> & {
  minColumnWidth?: string;
  columns?: number;
}) {
  const Component = as as ElementType;
  const gapValue = resolveGap(gap);
  const classes = [styles.grid, className].filter(Boolean).join(' ');
  const template =
    typeof columns === 'number' && columns > 0
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))`;

  return (
    <Component
      className={classes}
      style={{ gap: gapValue, gridTemplateColumns: template, ...style }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function Section<T extends HTMLElement = HTMLElement>({
  as = 'section',
  className,
  style,
  children,
  padding = 'md',
  width = 'var(--pixellab-layout-max-width)',
  ...rest
}: BaseProps<T> & { padding?: SpacingKey | 'none' | string; width?: string }) {
  const Component = as as ElementType;
  const paddingValue =
    padding === 'none' ? '0' : resolveGap(padding as SpacingKey | string) ?? undefined;
  const classes = [styles.section, className].filter(Boolean).join(' ');

  return (
    <Component
      className={classes}
      style={{
        paddingInline: paddingValue,
        maxWidth: width,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}
