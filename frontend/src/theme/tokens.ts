import type { CSSProperties } from 'react';
import { Press_Start_2P } from 'next/font/google';

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
      base: '#060014',
      panel: 'rgba(6, 0, 20, 0.75)',
      glow: '#12052b',
    },
    accent: {
      primary: '#f7b733',
      secondary: '#b958f6',
      success: '#35d070',
    },
    text: {
      primary: '#fefae0',
      muted: 'rgba(254, 250, 224, 0.72)',
    },
    border: {
      subtle: 'rgba(249, 96, 204, 0.35)',
      bold: 'rgba(247, 183, 51, 0.8)',
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
    contentMaxWidth: '1200px',
    pagePadding: 'clamp(1rem, 4vw, 3rem)',
    navHeight: '4rem',
  },
  effects: {
    grid: {
      size: 32,
      opacity: 0.18,
    },
    panelBlur: '12px',
    panelShadow: '0 20px 60px rgba(0, 0, 0, 0.55)',
  },
  assets: {
    wordmark: '/pixellab/wordmark.svg',
    grid: '/pixellab/grid.svg',
  },
};

export const pixellabFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pixellab',
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
  };

  return cssVariables;
}
