import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { getPixellabCssVariables, pixellabFont } from '@/theme/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: 'Treazr Island | Pixellab Visual Theme',
  description:
    'A Pixellab.ai-driven retro hub. This layout loads the base grid, palette, and typography for EmulatorJS views.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const cssVariables = getPixellabCssVariables();

  return (
    <html lang="en">
      <body className={pixellabFont.variable} style={cssVariables}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
