#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

function hasTsx(requireFn) {
  try {
    requireFn.resolve('tsx');
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
      return false;
    }
    throw error;
  }
}

function runSeed() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['run', 'prisma:seed:platforms'], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      const message = `[seed:platforms] Seeding interrupted by signal ${signal}`;
      console.error(message);
      process.exit(1);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('[seed:platforms] Failed to launch seed command:', error);
    process.exit(1);
  });
}

function main() {
  const requireFn = createRequire(import.meta.url);
  if (!hasTsx(requireFn)) {
    console.log('[seed:platforms] Skipping platform seed because the tsx runtime is not installed.');
    console.log('[seed:platforms] Install dev dependencies (npm install) to enable TypeScript seed scripts.');
    return;
  }

  runSeed();
}

try {
  main();
} catch (error) {
  console.error('[seed:platforms] Unexpected error while attempting to run the seed:', error);
  process.exit(1);
}
