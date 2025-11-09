import { spawnSync } from 'node:child_process';

const AUTO_ROLLBACK_MIGRATIONS = new Set([
  '202502040001_add_netplay_signal_messages',
]);

function runPrisma(args: string[], options?: { inheritStdout?: boolean }) {
  const stdio: any = options?.inheritStdout
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

  if (result.status !== 0) {
    const stderr = result.stderr || '';
    throw new Error(`Failed to run prisma ${args.join(' ')}: ${stderr}`.trim());
  }

  return result.stdout ?? '';
}

function parseStatus(output: string) {
  try {
    return JSON.parse(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to parse prisma migrate status JSON output: ${message}`);
  }
}

async function main() {
  const statusOutput = runPrisma(['migrate', 'status', '--json']);
  const status = parseStatus(statusOutput) as {
    failedMigrationNames?: string[];
  };

  const failedMigrations = status.failedMigrationNames ?? [];
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

main().catch((error) => {
  console.error('[prisma:resolve] Failed to resolve migrations:', error);
  process.exitCode = 1;
});
