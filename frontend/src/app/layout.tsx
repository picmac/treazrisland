import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const PIXELLAB_THEME = {
  palette: {
    primary: '#f7b733',
    secondary: '#b958f6',
    background: {
      base: '#060014',
      panel: '#12052b'
    },
    foreground: '#fefae0'
  },
  gridOverlay: {
    size: 32,
    opacity: 0.15
  },
  typography: {
    family: 'Press Start 2P, system-ui',
    weight: 400
  }
} as const;

export const metadata: Metadata = {
  title: 'Treazr Island | Pixellab Visual Theme',
  description:
    'A Pixellab.ai-driven retro hub. This layout loads the base grid, palette, and typography for EmulatorJS views.'
};

type PixellabThemeProviderProps = {
  children: ReactNode;
};

function PixellabThemeProvider({ children }: PixellabThemeProviderProps) {
  const gridBackground = `linear-gradient(rgba(255, 255, 255, ${PIXELLAB_THEME.gridOverlay.opacity}) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, ${PIXELLAB_THEME.gridOverlay.opacity}) 1px, transparent 1px)`;

  return (
    <div
      className="pixellab-grid"
      style={{
        backgroundColor: PIXELLAB_THEME.palette.background.base,
        backgroundImage: `${gridBackground}`,
        backgroundSize: `${PIXELLAB_THEME.gridOverlay.size}px ${PIXELLAB_THEME.gridOverlay.size}px`,
        color: PIXELLAB_THEME.palette.foreground,
        fontFamily: PIXELLAB_THEME.typography.family,
        fontWeight: PIXELLAB_THEME.typography.weight
      }}
    >
      <header className="pixellab-content pixellab-theme__header">
        Pixellab.ai Core Theme
      </header>
      <main className="pixellab-content" role="main">
        {children}
      </main>
      <footer className="pixellab-content" style={{ color: PIXELLAB_THEME.palette.secondary }}>
        Inspired by Pixellab.ai concept art drops — swap assets here when the API integration lands.
      </footer>
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PixellabThemeProvider>{children}</PixellabThemeProvider>
      </body>
    </html>
  );
}
