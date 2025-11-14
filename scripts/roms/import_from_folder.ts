import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';

interface RomImportManifest {
  title: string;
  description?: string;
  platformId: string;
  releaseYear?: number;
  genres?: string[];
  asset: {
    filename: string;
    contentType: string;
    checksum: string;
  };
}

const IMPORT_ROOT = path.resolve(process.cwd(), 'data/import');
const PROCESSED_ROOT = path.join(IMPORT_ROOT, 'processed');
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const ADMIN_ROM_PATH = '/admin/roms';

const apiBaseUrl = (process.env.ROM_IMPORT_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
const apiToken = process.env.ROM_IMPORT_API_TOKEN;

const log = (...args: unknown[]): void => {
  console.log('[rom-import]', ...args);
};

const readManifest = async (manifestPath: string): Promise<RomImportManifest> => {
  const manifestRaw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(manifestRaw);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Manifest must be a JSON object');
  }

  const { title, description, platformId, releaseYear, genres, asset } =
    parsed as RomImportManifest;

  if (!title || !platformId || !asset) {
    throw new Error('Manifest must include title, platformId, and asset definitions');
  }

  if (!asset.filename || !asset.contentType || !asset.checksum) {
    throw new Error('Asset entries must include filename, contentType, and checksum');
  }

  return { title, description, platformId, releaseYear, genres, asset };
};

const ensureDirectories = async (): Promise<void> => {
  await mkdir(IMPORT_ROOT, { recursive: true });
  await mkdir(PROCESSED_ROOT, { recursive: true });
};

const calculateChecksum = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');

const buildRomPayload = (manifest: RomImportManifest, romBuffer: Buffer) => ({
  title: manifest.title,
  description: manifest.description,
  platformId: manifest.platformId,
  releaseYear: manifest.releaseYear,
  genres: manifest.genres,
  asset: {
    type: 'ROM',
    filename: manifest.asset.filename,
    contentType: manifest.asset.contentType,
    checksum: calculateChecksum(romBuffer),
    data: romBuffer.toString('base64'),
  },
});

const moveProcessedFiles = async (manifestPath: string, romPath: string): Promise<void> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destinationDir = path.join(
    PROCESSED_ROOT,
    `${path.basename(manifestPath, '.json')}-${timestamp}`,
  );

  await mkdir(destinationDir, { recursive: true });

  await rename(romPath, path.join(destinationDir, path.basename(romPath)));
  await rename(manifestPath, path.join(destinationDir, path.basename(manifestPath)));
};

const resolveUnderImportRoot = (filePath: string): string => {
  const resolved = path.resolve(IMPORT_ROOT, filePath);
  const relative = path.relative(IMPORT_ROOT, resolved);

  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return resolved;
  }

  throw new Error(`File path escapes import root: ${filePath}`);
};

const processManifestFile = async (manifestPath: string): Promise<void> => {
  log(`Processing manifest ${path.basename(manifestPath)}`);
  const manifest = await readManifest(manifestPath);
  const romPath = resolveUnderImportRoot(manifest.asset.filename);

  const stats = await stat(romPath).catch(() => null);
  if (!stats?.isFile()) {
    throw new Error(`Referenced ROM file not found: ${manifest.asset.filename}`);
  }

  const romBuffer = await readFile(romPath);
  const actualChecksum = calculateChecksum(romBuffer);

  if (actualChecksum.toLowerCase() !== manifest.asset.checksum.toLowerCase()) {
    throw new Error(
      `Checksum mismatch for ${manifest.asset.filename}: expected ${manifest.asset.checksum}, got ${actualChecksum}`,
    );
  }

  const payload = buildRomPayload(manifest, romBuffer);

  const response = await fetch(`${apiBaseUrl}${ADMIN_ROM_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `API rejected ROM ${manifest.title}: ${response.status} ${response.statusText} ${errorBody}`,
    );
  }

  log(`Successfully registered ROM ${manifest.title}`);
  await moveProcessedFiles(manifestPath, romPath);
};

const main = async (): Promise<void> => {
  await ensureDirectories();

  const entries = await readdir(IMPORT_ROOT, { withFileTypes: true });
  const manifestFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(IMPORT_ROOT, entry.name));

  if (!manifestFiles.length) {
    log('No manifest files found. Place *.json manifest files into data/import.');
    return;
  }

  let successCount = 0;

  for (const manifestPath of manifestFiles) {
    try {
      await processManifestFile(manifestPath);
      successCount += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[rom-import] Failed to process ${path.basename(manifestPath)}: ${reason}`);
    }
  }

  log(`Completed import run. ${successCount} of ${manifestFiles.length} manifest(s) processed.`);
};

void main().catch((error) => {
  console.error('[rom-import] Unhandled error', error);
  process.exitCode = 1;
});
