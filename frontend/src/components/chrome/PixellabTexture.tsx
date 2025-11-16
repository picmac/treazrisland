import type { ReactNode, HTMLAttributes } from 'react';
import { PIXELLAB_TOKENS } from '@/theme/tokens';

type PixellabTextureProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function PixellabTexture({ children, style, ...rest }: PixellabTextureProps) {
  const { colors, effects } = PIXELLAB_TOKENS;
  const gridTexture = `linear-gradient(rgba(255, 255, 255, ${effects.grid.opacity}) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, ${effects.grid.opacity}) 1px, transparent 1px)`;
  const aurora = `radial-gradient(circle at 20% 20%, rgba(185, 88, 246, 0.35), transparent 55%),
    radial-gradient(circle at 80% 0%, rgba(247, 183, 51, 0.25), transparent 45%)`;

  return (
    <div
      {...rest}
      style={{
        minHeight: '100vh',
        backgroundColor: colors.background.base,
        backgroundImage: `${aurora}, ${gridTexture}`,
        backgroundSize: `auto, ${effects.grid.size}px ${effects.grid.size}px`,
        backgroundBlendMode: 'screen',
        color: colors.text.primary,
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
