'use client';

import type { ReactNode } from 'react';
import { usePixellabTheme } from './ThemeProvider';

export function PixellabThemeSurface({ children }: { children: ReactNode }) {
  const { tokens, status, error } = usePixellabTheme();

  const gridBackground = `linear-gradient(rgba(255, 255, 255, ${tokens.gridOverlay.opacity}) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, ${tokens.gridOverlay.opacity}) 1px, transparent 1px)`;

  return (
    <div
      className="pixellab-grid"
      style={{
        backgroundColor: tokens.palette.background.base,
        backgroundImage: gridBackground,
        backgroundSize: `${tokens.gridOverlay.size}px ${tokens.gridOverlay.size}px`,
        color: tokens.palette.foreground,
        fontFamily: tokens.typography.family,
        fontWeight: tokens.typography.weight
      }}
    >
      <header
        className="pixellab-content pixellab-theme__header"
        style={{
          paddingBlock: tokens.spacing.sm,
          letterSpacing: '0.25rem'
        }}
      >
        Pixellab.ai Core Theme
      </header>
      <main className="pixellab-content" role="main">
        {children}
        {status === 'error' && (
          <p role="status" style={{ marginTop: tokens.spacing.md }}>
            Theme manifest failed to load. Using fallback tokens{error ? `: ${error}` : ''}.
          </p>
        )}
      </main>
      <footer
        className="pixellab-content"
        style={{
          color: tokens.palette.secondary,
          paddingBottom: tokens.spacing.lg
        }}
      >
        Inspired by Pixellab.ai concept art drops — swap assets here when the API integration lands.
      </footer>
    </div>
  );
}
