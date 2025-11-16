import type { HTMLAttributes, ReactNode } from 'react';
import { PIXELLAB_TOKENS } from '@/theme/tokens';

type GridElement = 'div' | 'section' | 'ul' | 'ol';

type PixellabGridProps = {
  as?: GridElement;
  children: ReactNode;
  minColumnWidth?: string;
  gap?: keyof typeof PIXELLAB_TOKENS.spacing;
} & HTMLAttributes<HTMLElement>;

export function PixellabGrid({
  as = 'section',
  children,
  minColumnWidth = '260px',
  gap = 'md',
  style,
  ...rest
}: PixellabGridProps) {
  const Component = as as keyof JSX.IntrinsicElements;
  const spacing = PIXELLAB_TOKENS.spacing[gap];
  const { layout } = PIXELLAB_TOKENS;

  return (
    <Component
      {...rest}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))`,
        gap: spacing,
        maxWidth: layout.contentMaxWidth,
        margin: '0 auto',
        width: '100%',
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
