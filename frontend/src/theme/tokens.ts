import type { CSSProperties } from 'react';
import { Manrope, Space_Grotesk } from 'next/font/google';

type PixellabCssVariables = CSSProperties & Record<`--${string}`, string>;

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
  radii: {
    sm: string;
    md: string;
    lg: string;
  };
  shadows: {
    soft: string;
    strong: string;
  };
  typography: {
    display: string;
    body: string;
    weight: {
      regular: number;
      medium: number;
      bold: number;
    };
    letterSpacing: {
      tight: string;
      loose: string;
    };
  };
  breakpoints: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
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
      glow: '#111a2e',
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
  radii: {
    sm: '0.5rem',
    md: '0.9rem',
    lg: '1.15rem',
  },
  shadows: {
    soft: '0 10px 30px rgba(0, 0, 0, 0.22)',
    strong: '0 18px 48px rgba(0, 0, 0, 0.3)',
  },
  typography: {
    display: 'var(--font-pixellab)',
    body: 'var(--font-body)',
    weight: {
      regular: 400,
      medium: 600,
      bold: 700,
    },
    letterSpacing: {
      tight: '0.01em',
      loose: '0.2em',
    },
  },
  breakpoints: {
    xs: '360px',
    sm: '600px',
    md: '960px',
    lg: '1280px',
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
    '--pixellab-color-bg-base': tokens.colors.background.base,
    '--pixellab-color-bg-panel': tokens.colors.background.panel,
    '--pixellab-color-bg-glow': tokens.colors.background.glow,
    '--pixellab-color-accent-primary': tokens.colors.accent.primary,
    '--pixellab-color-accent-secondary': tokens.colors.accent.secondary,
    '--pixellab-color-accent-success': tokens.colors.accent.success,
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
    '--pixellab-toolbar-height': tokens.layout.navHeight,
    '--pixellab-surface': tokens.colors.background.panel,
    '--pixellab-surface-strong': tokens.colors.background.glow,
    '--pixellab-radius-sm': tokens.radii.sm,
    '--pixellab-radius-md': tokens.radii.md,
    '--pixellab-radius-lg': tokens.radii.lg,
    '--shadow-soft': tokens.shadows.soft,
    '--shadow-strong': tokens.shadows.strong,
    '--pixellab-spacing-xxs': tokens.spacing.xxs,
    '--pixellab-spacing-xs': tokens.spacing.xs,
    '--pixellab-spacing-sm': tokens.spacing.sm,
    '--pixellab-spacing-md': tokens.spacing.md,
    '--pixellab-spacing-lg': tokens.spacing.lg,
    '--pixellab-spacing-xl': tokens.spacing.xl,
    '--pixellab-breakpoint-xs': tokens.breakpoints.xs,
    '--pixellab-breakpoint-sm': tokens.breakpoints.sm,
    '--pixellab-breakpoint-md': tokens.breakpoints.md,
    '--pixellab-breakpoint-lg': tokens.breakpoints.lg,
    '--pixellab-font-body': tokens.typography.body,
    '--pixellab-font-display': tokens.typography.display,
    '--pixellab-font-weight-regular': `${tokens.typography.weight.regular}`,
    '--pixellab-font-weight-medium': `${tokens.typography.weight.medium}`,
    '--pixellab-font-weight-bold': `${tokens.typography.weight.bold}`,
    '--pixellab-letter-spacing-tight': tokens.typography.letterSpacing.tight,
    '--pixellab-letter-spacing-loose': tokens.typography.letterSpacing.loose,
  };

  return cssVariables;
}
