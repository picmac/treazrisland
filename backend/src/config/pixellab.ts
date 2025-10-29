import { env } from "./env.js";

export type PixelLabConfig = {
  apiKey: string;
  styleId: string;
  baseUrl: string;
  cacheTtlSeconds: number;
  timeoutMs: number;
  assetPrefix: string;
};

export function getPixelLabConfig(): PixelLabConfig | null {
  if (!env.PIXELLAB_API_KEY || !env.PIXELLAB_STYLE_ID) {
    return null;
  }

  return {
    apiKey: env.PIXELLAB_API_KEY,
    styleId: env.PIXELLAB_STYLE_ID,
    baseUrl: env.PIXELLAB_BASE_URL,
    cacheTtlSeconds: env.PIXELLAB_CACHE_TTL_SECONDS,
    timeoutMs: env.PIXELLAB_TIMEOUT_MS,
    assetPrefix: env.PIXELLAB_ASSET_PREFIX
  };
}
