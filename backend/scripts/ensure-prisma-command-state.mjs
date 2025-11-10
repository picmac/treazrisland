import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'prisma-nodejs');
const COMMANDS_FILE = path.join(CONFIG_DIR, 'commands.json');
const DEFAULT_CONTENT = JSON.stringify({ commands: {} }, null, 2) + '\n';

async function ensurePrismaCommandState() {
  await mkdir(CONFIG_DIR, { recursive: true });

  let needsWrite = false;

  try {
    await access(COMMANDS_FILE, constants.F_OK);
    const raw = await readFile(COMMANDS_FILE, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') {
        needsWrite = true;
      }
    } catch (error) {
      console.warn('[prisma-cli] Detected invalid commands.json; resetting to safe default.');
      needsWrite = true;
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      needsWrite = true;
    } else {
      throw error;
    }
  }

  if (needsWrite) {
    await writeFile(COMMANDS_FILE, DEFAULT_CONTENT, { encoding: 'utf8', mode: 0o600 });
    console.info(`[prisma-cli] Initialized command state at ${COMMANDS_FILE}`);
  }
}

function isMissingFileError(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}

ensurePrismaCommandState().catch((error) => {
  console.error('[prisma-cli] Failed to ensure command state file:', error);
  process.exitCode = 1;
});
