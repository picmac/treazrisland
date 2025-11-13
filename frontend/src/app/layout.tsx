import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PixellabThemeSurface } from '@/theme/PixellabThemeSurface';
import { ThemeProvider } from '@/theme/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Treazr Island | Pixellab Visual Theme',
  description:
    'A Pixellab.ai-driven retro hub. This layout loads the base grid, palette, and typography for EmulatorJS views.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <PixellabThemeSurface>{children}</PixellabThemeSurface>
        </ThemeProvider>
      </body>
    </html>
  );
}
