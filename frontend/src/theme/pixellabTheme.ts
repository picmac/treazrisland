export type PixellabSpacingScale = {
  none: string;
  xxs: string;
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
};

export type PixellabTypographyScale = {
  family: string;
  weight: number;
  size: {
    base: string;
    small: string;
    medium: string;
    large: string;
  };
  lineHeight: {
    compact: string;
    normal: string;
    relaxed: string;
  };
};

export type PixellabThemeTokens = {
  palette: {
    primary: string;
    secondary: string;
    background: {
      base: string;
      panel: string;
    };
    foreground: string;
  };
  spacing: PixellabSpacingScale;
  typography: PixellabTypographyScale;
  gridOverlay: {
    size: number;
    opacity: number;
  };
};

export type PixellabAssetMetadata = {
  promptId?: string;
  model?: string;
  seed?: string;
  palette?: string;
  previewUrl?: string;
  [key: string]: unknown;
};

export type PixellabAsset = {
  id: string;
  label: string;
  type: 'background' | 'logo' | 'sprite' | 'audio' | 'video' | 'ui';
  src: string;
  description?: string;
  metadata?: PixellabAssetMetadata;
};

export type PixellabThemeMetadata = {
  themeId: string;
  source: string;
  assetCount: number;
  apiVersion?: string;
  [key: string]: unknown;
};

export type PixellabThemeManifest = {
  version: string;
  generatedAt: string;
  tokens?: Partial<PixellabThemeTokens>;
  assets?: PixellabAsset[];
  metadata?: PixellabThemeMetadata;
};

export const FALLBACK_PIXELLAB_THEME: PixellabThemeTokens = {
  palette: {
    primary: '#f7b733',
    secondary: '#b958f6',
    background: {
      base: '#060014',
      panel: '#12052b',
    },
    foreground: '#fefae0',
  },
  spacing: {
    none: '0',
    xxs: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  typography: {
    family:
      '"Press Start 2P", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    weight: 400,
    size: {
      base: '1rem',
      small: '0.85rem',
      medium: '1.1rem',
      large: '1.35rem',
    },
    lineHeight: {
      compact: '1.1',
      normal: '1.4',
      relaxed: '1.75',
    },
  },
  gridOverlay: {
    size: 32,
    opacity: 0.15,
  },
};

export const FALLBACK_ASSETS: PixellabAsset[] = [
  {
    id: 'hero-grid',
    label: 'Neon grid wallpaper',
    type: 'background',
    src: '/themes/pixellab/hero-grid.png',
    description: 'Placeholder reference for the Pixellab grid wallpaper export.',
  },
  {
    id: 'treazr-wordmark',
    label: 'Treazr Island wordmark',
    type: 'logo',
    src: '/themes/pixellab/wordmark.png',
    description: 'Wordmark produced from Pixellab prompt set A.',
  },
];

export function mergeThemeTokens(
  base: PixellabThemeTokens,
  overrides?: Partial<PixellabThemeTokens>,
): PixellabThemeTokens {
  if (!overrides) {
    return base;
  }

  return {
    palette: {
      ...base.palette,
      ...overrides.palette,
      background: {
        ...base.palette.background,
        ...(overrides.palette?.background ?? {}),
      },
    },
    spacing: {
      ...base.spacing,
      ...(overrides.spacing ?? {}),
    },
    typography: {
      ...base.typography,
      ...(overrides.typography ?? {}),
      size: {
        ...base.typography.size,
        ...(overrides.typography?.size ?? {}),
      },
      lineHeight: {
        ...base.typography.lineHeight,
        ...(overrides.typography?.lineHeight ?? {}),
      },
    },
    gridOverlay: {
      ...base.gridOverlay,
      ...(overrides.gridOverlay ?? {}),
    },
  };
}
