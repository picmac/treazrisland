#!/usr/bin/env ts-node

import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import type {
  PixellabAsset,
  PixellabAssetMetadata,
  PixellabThemeManifest,
  PixellabThemeMetadata,
  PixellabThemeTokens,
} from '../../frontend/src/theme/pixellabTheme';

type PixellabApiAsset = {
  id: string;
  label: string;
  type: PixellabAsset['type'];
  description?: string;
  metadata?: PixellabAssetMetadata;
  downloadUrl: string;
  fileName?: string;
};

type PixellabApiManifest = {
  version?: string;
  generatedAt?: string;
  tokens?: Partial<PixellabThemeTokens>;
  assets?: PixellabApiAsset[];
  metadata?: PixellabThemeMetadata & {
    apiVersion?: string;
  };
};

type CliOptions = {
  themeId: string;
  outputDir: string;
};

const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 1_000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    themeId: process.env.PIXELLAB_THEME_ID ?? 'treazr-island-core',
    outputDir: path.join(repoRoot, 'frontend', 'public', 'themes', 'pixellab'),
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if ((arg === '--theme' || arg === '--theme-id') && argv[index + 1]) {
      options.themeId = argv[index + 1];
      index += 1;
    } else if ((arg === '--out' || arg === '--output-dir') && argv[index + 1]) {
      options.outputDir = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

function getApiBaseUrl(): string {
  return process.env.PIXELLAB_API_BASE_URL ?? 'https://api.pixellab.ai/v1';
}

function getApiToken(): string {
  const token = process.env.PIXELLAB_API_TOKEN;
  if (!token) {
    throw new Error('Missing PIXELLAB_API_TOKEN environment variable.');
  }
  return token;
}

async function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function computeRetryDelayMs(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const parsed = Number.parseFloat(retryAfter);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed * 1_000;
    }
  }
  const cappedAttempt = Math.min(attempt, 8);
  return BASE_DELAY_MS * 2 ** (cappedAttempt - 1);
}

async function requestWithRetry(url: string, init: RequestInit, attempt = 1): Promise<Response> {
  const response = await fetch(url, init);
  if (
    (response.status === 429 || (response.status >= 500 && response.status < 600)) &&
    attempt < MAX_RETRY_ATTEMPTS
  ) {
    const retryDelay = computeRetryDelayMs(attempt, response.headers.get('retry-after'));
    console.warn(
      `\u26a0\ufe0f  Pixellab API responded with ${response.status}. Retrying in ${retryDelay}ms (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}).`,
    );
    if (response.body) {
      try {
        await response.body.cancel();
      } catch {
        // Ignore cancellation errors.
      }
    }
    await delay(retryDelay);
    return requestWithRetry(url, init, attempt + 1);
  }

  return response;
}

async function fetchThemeManifest(themeId: string, token: string): Promise<PixellabApiManifest> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl.replace(/\/$/, '')}/themes/${encodeURIComponent(themeId)}`;
  console.log(`\ud83d\udcc3  Fetching Pixellab manifest for theme "${themeId}" from ${url}`);
  const response = await requestWithRetry(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'treazrisland-pixellab-fetcher',
    },
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Pixellab manifest request failed (${response.status}): ${bodyText}`);
  }

  const payload = (await response.json()) as PixellabApiManifest;
  if (!payload.assets?.length) {
    console.warn('\u26a0\ufe0f  Pixellab manifest did not return any assets.');
  }
  return payload;
}

function toPublicPath(fileName: string): string {
  return path.posix.join('/themes/pixellab', fileName.replace(/\\/g, '/'));
}

function deriveExtension(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl);
    const ext = path.extname(url.pathname);
    if (ext) {
      return ext;
    }
  } catch (error) {
    console.warn(`\u26a0\ufe0f  Unable to parse download URL for extension: ${downloadUrl}`);
  }
  return '.bin';
}

function sanitizeFileName(baseName: string, extension: string): string {
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const safeBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safeBase || 'asset'}${normalizedExtension}`;
}

function resolveAssetFileName(asset: PixellabApiAsset, fallbackExtension: string): string {
  const providedFileName = asset.fileName?.trim();
  if (providedFileName) {
    const containsSeparators = /[\\/]/.test(providedFileName);
    const isDotOnly = /^\.+$/.test(providedFileName);
    if (!containsSeparators && !isDotOnly) {
      const parsed = path.parse(providedFileName);
      const baseName = parsed.name || parsed.base;
      const extension = parsed.ext || fallbackExtension;
      return sanitizeFileName(baseName, extension);
    }

    console.warn(
      `\u26a0\ufe0f  Asset ${asset.id} provided an invalid file name "${providedFileName}". Falling back to a sanitized identifier.`,
    );
  }

  return sanitizeFileName(asset.id, fallbackExtension);
}

function ensureSafeDestination(outputDir: string, fileName: string): string {
  const resolvedOutput = path.resolve(outputDir);
  const resolvedDestination = path.resolve(resolvedOutput, fileName);
  if (!resolvedDestination.startsWith(`${resolvedOutput}${path.sep}`)) {
    throw new Error(
      `Resolved asset path ${resolvedDestination} is outside the output directory ${resolvedOutput}`,
    );
  }
  return resolvedDestination;
}

async function downloadAsset(
  asset: PixellabApiAsset,
  outputDir: string,
  token: string,
): Promise<PixellabAsset | undefined> {
  if (!asset.downloadUrl) {
    console.warn(`\u26a0\ufe0f  Asset ${asset.id} is missing a download URL. Skipping.`);
    return undefined;
  }

  const extension = deriveExtension(asset.downloadUrl);
  const fileName = resolveAssetFileName(asset, extension);
  const destinationPath = ensureSafeDestination(outputDir, fileName);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  console.log(`\ud83d\udcbe  Downloading ${asset.id} -> ${destinationPath}`);

  const response = await requestWithRetry(asset.downloadUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'treazrisland-pixellab-fetcher',
    },
  });

  if (!response.ok || !response.body) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Asset download failed (${response.status}): ${bodyText}`);
  }

  await pipeline(response.body, createWriteStream(destinationPath));
  console.log(`\u2705  Saved asset ${asset.id} (${fileName})`);

  const manifestAsset: PixellabAsset = {
    id: asset.id,
    label: asset.label,
    type: asset.type,
    src: toPublicPath(fileName),
    description: asset.description,
    metadata: asset.metadata,
  };

  return manifestAsset;
}

function buildManifest(
  apiManifest: PixellabApiManifest,
  assets: PixellabAsset[],
  themeId: string,
): PixellabThemeManifest {
  const sortedAssets = [...assets].sort((a, b) => a.id.localeCompare(b.id));
  const metadata: PixellabThemeMetadata = {
    themeId,
    source: 'pixellab.ai',
    assetCount: sortedAssets.length,
    apiVersion: apiManifest.metadata?.apiVersion,
  };

  return {
    version: apiManifest.version ?? '0.0.0',
    generatedAt: apiManifest.generatedAt ?? new Date().toISOString(),
    tokens: apiManifest.tokens,
    assets: sortedAssets,
    metadata,
  };
}

async function run() {
  const token = getApiToken();
  const { themeId, outputDir } = parseArgs(process.argv);
  const manifestPath = path.join(outputDir, 'manifest.json');

  const apiManifest = await fetchThemeManifest(themeId, token);
  await mkdir(outputDir, { recursive: true });

  const downloadedAssets: PixellabAsset[] = [];
  for (const asset of apiManifest.assets ?? []) {
    try {
      const manifestAsset = await downloadAsset(asset, outputDir, token);
      if (manifestAsset) {
        downloadedAssets.push(manifestAsset);
      }
    } catch (error) {
      console.error(`\u274c  Failed to download asset ${asset.id}:`, error);
      throw error;
    }
  }

  const manifest = buildManifest(apiManifest, downloadedAssets, themeId);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\ud83d\udcc4  Manifest written to ${manifestPath}`);
}

run().catch((error) => {
  console.error('\u274c  Pixellab asset sync failed.');
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
