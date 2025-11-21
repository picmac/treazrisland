#!/usr/bin/env node

const { engines = {}, packageManager = '' } = require('../package.json');

const userAgent = process.env.npm_config_user_agent || '';
const isPnpm = userAgent.includes('pnpm/');

if (!isPnpm) {
  console.error(
    '[install] pnpm is required for this workspace. Rerun the command with pnpm so pnpm-lock.yaml is respected.\n' +
      'Example: corepack pnpm install --frozen-lockfile'
  );
  process.exit(1);
}

const pnpmVersion = (() => {
  const uaMatch = userAgent.match(/pnpm\/([\d.]+)/);
  if (uaMatch?.[1]) return uaMatch[1];
  return process.versions.pnpm;
})();
const engineRange = engines.pnpm || '';
const rangeMatch = engineRange.match(/>=\s*([\d.]+)\s*<\s*(\d+)/);
const minVersion = rangeMatch ? rangeMatch[1] : null;
const maxMajor = rangeMatch ? Number(rangeMatch[2]) : null;

function parseVersion(version) {
  return version.split('.').map((part) => Number.parseInt(part, 10));
}

function isAtLeast(version, floor) {
  const [major = 0, minor = 0, patch = 0] = parseVersion(version);
  const [floorMajor = 0, floorMinor = 0, floorPatch = 0] = parseVersion(floor);

  if (major !== floorMajor) return major > floorMajor;
  if (minor !== floorMinor) return minor > floorMinor;
  return patch >= floorPatch;
}

if (!pnpmVersion) {
  console.error('[install] Unable to read pnpm version from runtime. Please rerun with pnpm.');
  process.exit(1);
}

if (minVersion && !isAtLeast(pnpmVersion, minVersion)) {
  console.error(
    `[install] pnpm ${pnpmVersion} is below the required minimum (${engineRange}). Install ${packageManager || `pnpm@${minVersion}`}.`
  );
  process.exit(1);
}

const pnpmMajor = Number.parseInt(pnpmVersion.split('.')[0], 10);

if (Number.isInteger(maxMajor) && pnpmMajor >= maxMajor) {
  console.error(
    `[install] pnpm ${pnpmVersion} is newer than the supported major specified in engines (${engineRange}). Please switch to ${packageManager || `pnpm ${engineRange}`}.`
  );
  process.exit(1);
}
