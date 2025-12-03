import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppQueryProvider } from '@/components/providers/AppQueryProvider';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { bodyFont, getPixellabCssVariables, pixellabFont } from '@/theme/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: 'Treazr Island | Pixellab Visual Theme',
  description:
    'A Pixellab.ai-driven retro hub. This layout loads the base grid, palette, and typography for EmulatorJS views.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const cssVariables = getPixellabCssVariables();
  const fontClassName = `${pixellabFont.variable} ${bodyFont.variable}`;

  return (
    <html lang="en">
      <body className={fontClassName} style={cssVariables}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <ThemeProvider>
          <AppQueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </AppQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
