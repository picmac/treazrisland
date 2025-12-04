import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ProcessEnv } from 'node:process';
import { parse } from 'yaml';

type DependencyKey = 'node' | 'pnpm' | 'postgresql' | 'redis' | 'playwright' | 'prisma';

type Matrix = Record<DependencyKey, string>;

type Check = {
  key: DependencyKey;
  label: string;
  expected: string;
  actual: string;
  source: string;
};

const MATRIX_PATH = path.join(__dirname, '..', 'docs', 'dependency-matrix.md');
const COMPOSE_PATH = path.join(__dirname, '..', 'infrastructure', 'compose', 'docker-compose.yml');

const dependencyLabels: Record<DependencyKey, string> = {
  node: 'Node.js',
  pnpm: 'pnpm',
  postgresql: 'PostgreSQL',
  redis: 'Redis',
  playwright: 'Playwright',
  prisma: 'Prisma',
};

const normalizeVersion = (value: string): string => {
  const versionMatch = value.trim().match(/[0-9][0-9A-Za-z.+:-]*/);
  if (!versionMatch) {
    throw new Error(`Unable to extract version from "${value}".`);
  }

  return versionMatch[0];
};

const runCommand = (
  command: string,
  args: string[],
  friendlyName: string,
  env?: ProcessEnv,
): string => {
  const output = execSync([command, ...args].join(' '), {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });

  const normalizedOutput = normalizeVersion(output);
  console.log(`${friendlyName}: ${normalizedOutput}`);
  return normalizedOutput;
};

const parseMatrix = (): Matrix => {
  const content = fs.readFileSync(MATRIX_PATH, 'utf8');
  const lines = content.split('\n').filter((line) => line.trim().startsWith('|'));
  const pinned: Partial<Matrix> = {};

  lines.forEach((line) => {
    const columns = line
      .split('|')
      .map((col) => col.trim())
      .filter(Boolean);

    const [dependency, , pinnedVersion] = columns;
    const entry = Object.entries(dependencyLabels).find(([, label]) => label === dependency);

    if (!entry) return;

    const [key] = entry as [DependencyKey, string];
    pinned[key] = normalizeVersion(pinnedVersion);
  });

  const missing = (Object.keys(dependencyLabels) as DependencyKey[]).filter((key) => !pinned[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing pinned version(s) in matrix for: ${missing
        .map((key) => dependencyLabels[key])
        .join(', ')}`,
    );
  }

  return pinned as Matrix;
};

const parseComposeServiceImage = (service: string): string => {
  const compose = parse(fs.readFileSync(COMPOSE_PATH, 'utf8')) as {
    services?: Record<string, unknown>;
  };
  const image = compose.services?.[service]?.image;

  if (!image || typeof image !== 'string') {
    throw new Error(`Compose file is missing an image tag for the "${service}" service.`);
  }

  const [, tag] = image.split(':');
  const version = normalizeVersion(tag ?? image);
  console.log(`${service} image tag: ${version}`);
  return version;
};

const collectActualVersions = (): Matrix => ({
  node: normalizeVersion(runCommand('node', ['-v'], 'Node.js runtime')),
  pnpm: normalizeVersion(runCommand('pnpm', ['-v'], 'pnpm CLI')),
  postgresql: parseComposeServiceImage('postgres'),
  redis: parseComposeServiceImage('redis'),
  playwright: normalizeVersion(
    runCommand('pnpm', ['exec', 'playwright', '--version'], 'Playwright CLI'),
  ),
  prisma: normalizeVersion(
    runCommand(
      'pnpm',
      ['--filter', '@treazrisland/backend', 'exec', 'prisma', '--version'],
      'Prisma CLI',
      { DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/treazrisland' },
    ),
  ),
});

const compare = (expected: Matrix, actual: Matrix): Check[] =>
  (Object.keys(dependencyLabels) as DependencyKey[]).map((key) => ({
    key,
    label: dependencyLabels[key],
    expected: expected[key],
    actual: actual[key],
    source: key === 'postgresql' || key === 'redis' ? 'docker-compose' : 'CLI',
  }));

const report = (checks: Check[]) => {
  const mismatches = checks.filter((check) => check.expected !== check.actual);
  const allowDrift = process.env.ALLOW_VERSION_DRIFT === '1';

  if (mismatches.length > 0) {
    const message = mismatches
      .map(
        (check) =>
          `- ${check.label}: expected ${check.expected} from matrix, but found ${check.actual} via ${check.source}.`,
      )
      .join('\n');

    if (allowDrift) {
      console.warn(`⚠️  Version drift detected (ignored via ALLOW_VERSION_DRIFT=1):\n${message}`);
      return;
    }

    throw new Error(`Version drift detected:\n${message}`);
  }

  console.log('✅ All dependency versions match the matrix.');
};

const main = () => {
  const expected = parseMatrix();
  const actual = collectActualVersions();
  const checks = compare(expected, actual);
  report(checks);
};

main();
