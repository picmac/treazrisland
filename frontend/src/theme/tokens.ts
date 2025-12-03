import type { CSSProperties } from 'react';
import { Manrope, Space_Grotesk } from 'next/font/google';

type PixellabCssVariables = CSSProperties & Record<`--pixellab-${string}`, string>;

export type PixellabTokens = {
  colors: {
    background: {
      base: string;
      panel: string;
      glow: string;
    };
    accent: {
      primary: string;
      secondary: string;
      success: string;
    };
    text: {
      primary: string;
      muted: string;
    };
    border: {
      subtle: string;
      bold: string;
    };
  };
  spacing: {
    xxs: string;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  layout: {
    contentMaxWidth: string;
    pagePadding: string;
    navHeight: string;
  };
  effects: {
    grid: {
      size: number;
      opacity: number;
    };
    panelBlur: string;
    panelShadow: string;
  };
  assets: {
    wordmark: string;
    grid: string;
  };
};

export const PIXELLAB_TOKENS: PixellabTokens = {
  colors: {
    background: {
      base: '#0b1320',
      panel: 'rgba(15, 21, 35, 0.9)',
      glow: '#0f192d',
    },
    accent: {
      primary: '#7ce0d3',
      secondary: '#8ab6ff',
      success: '#48d49f',
    },
    text: {
      primary: '#e6edf5',
      muted: '#9fb1c7',
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.08)',
      bold: 'rgba(124, 224, 211, 0.45)',
    },
  },
  spacing: {
    xxs: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2.5rem',
  },
  layout: {
    contentMaxWidth: '1160px',
    pagePadding: 'clamp(1rem, 4vw, 2.5rem)',
    navHeight: '4.25rem',
  },
  effects: {
    grid: {
      size: 28,
      opacity: 0.08,
    },
    panelBlur: '14px',
    panelShadow: '0 18px 48px rgba(0, 0, 0, 0.3)',
  },
  assets: {
    wordmark: '/pixellab/wordmark.svg',
    grid: '/pixellab/grid.svg',
  },
};

export const pixellabFont = Space_Grotesk({
  weight: ['600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixellab',
});

export const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-body',
});

export function getPixellabCssVariables(
  tokens: PixellabTokens = PIXELLAB_TOKENS,
): PixellabCssVariables {
  const cssVariables: PixellabCssVariables = {
    '--pixellab-bg-primary': tokens.colors.background.base,
    '--pixellab-bg-secondary': tokens.colors.background.glow,
    '--pixellab-accent': tokens.colors.accent.primary,
    '--pixellab-accent-muted': tokens.colors.accent.secondary,
    '--pixellab-foreground': tokens.colors.text.primary,
    '--pixellab-overlay-opacity': `${tokens.effects.grid.opacity}`,
    '--pixellab-toolbar-height': tokens.layout.navHeight,
    '--pixellab-color-bg-base': tokens.colors.background.base,
    '--pixellab-color-bg-panel': tokens.colors.background.panel,
    '--pixellab-color-bg-glow': tokens.colors.background.glow,
    '--pixellab-color-accent-primary': tokens.colors.accent.primary,
    '--pixellab-color-accent-secondary': tokens.colors.accent.secondary,
    '--pixellab-color-text-primary': tokens.colors.text.primary,
    '--pixellab-color-text-muted': tokens.colors.text.muted,
    '--pixellab-color-border-subtle': tokens.colors.border.subtle,
    '--pixellab-color-border-bold': tokens.colors.border.bold,
    '--pixellab-grid-size': `${tokens.effects.grid.size}px`,
    '--pixellab-grid-opacity': `${tokens.effects.grid.opacity}`,
    '--pixellab-panel-blur': tokens.effects.panelBlur,
    '--pixellab-panel-shadow': tokens.effects.panelShadow,
    '--pixellab-layout-max-width': tokens.layout.contentMaxWidth,
    '--pixellab-layout-padding': tokens.layout.pagePadding,
    '--pixellab-layout-nav-height': tokens.layout.navHeight,
    '--pixellab-font-body': 'var(--font-body)',
  };

  return cssVariables;
}
