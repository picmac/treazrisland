import { spawnSync } from 'node:child_process';

const AUTO_ROLLBACK_MIGRATIONS = new Set([
  '202502030001_create_netplay_core',
  '202502040001_add_netplay_signal_messages',
]);

/**
 * @typedef {Object} RunPrismaOptions
 * @property {boolean} [inheritStdout]
 * @property {boolean} [allowNonZeroExit]
 */

/**
 * @param {string[]} args
 * @param {RunPrismaOptions} [options]
 */
function runPrisma(args, options) {
  const stdio = options?.inheritStdout
    ? ['inherit', 'inherit', 'inherit']
    : ['ignore', 'pipe', 'pipe'];

  const result = spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf-8',
    stdio,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options?.allowNonZeroExit) {
    const stderr = result.stderr || '';
    throw new Error(`Failed to run prisma ${args.join(' ')}: ${stderr}`.trim());
  }

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 0,
  };
}

/**
 * @param {string} output
 */
function parseFailedMigrations(output) {
  const lines = output.split(/\r?\n/);
  const failed = [];
  let inFailedSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!inFailedSection) {
      if (/^Following migrations? have failed:$/i.test(line)) {
        inFailedSection = true;
      }
      continue;
    }

    if (line === '') {
      if (failed.length > 0) {
        break;
      }
      continue;
    }

    if (/^(During development|The failed migration)/i.test(line)) {
      break;
    }

    failed.push(line);
  }

  return failed;
}

function main() {
  const statusResult = runPrisma(['migrate', 'status'], { allowNonZeroExit: true });
  const combinedOutput = [statusResult.stdout, statusResult.stderr]
    .filter((value) => value && value.length > 0)
    .join('\n');
  const failedMigrations = parseFailedMigrations(combinedOutput);
  if (failedMigrations.length === 0) {
    console.log('[prisma:resolve] No failed migrations detected.');
    return;
  }

  const actionableMigrations = failedMigrations.filter((name) =>
    AUTO_ROLLBACK_MIGRATIONS.has(name),
  );

  const unsupportedMigrations = failedMigrations.filter(
    (name) => !AUTO_ROLLBACK_MIGRATIONS.has(name),
  );

  if (unsupportedMigrations.length > 0) {
    throw new Error(
      `Refusing to auto-resolve unsupported failed migrations: ${unsupportedMigrations.join(', ')}`,
    );
  }

  for (const migrationName of actionableMigrations) {
    console.log(`[prisma:resolve] Marking failed migration as rolled back: ${migrationName}`);
    runPrisma(['migrate', 'resolve', '--rolled-back', migrationName], { inheritStdout: true });
  }

  console.log('[prisma:resolve] Successfully marked failed migrations as rolled back.');
}

try {
  main();
} catch (error) {
  console.error('[prisma:resolve] Failed to resolve migrations:', error);
  process.exitCode = 1;
}
