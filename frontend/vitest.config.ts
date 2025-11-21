import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const workspaceDir = fileURLToPath(new URL('.', import.meta.url));
const srcDir = join(workspaceDir, 'src');

const hasUnitTests = existsSync(srcDir) && directoryContainsTests(srcDir);

function directoryContainsTests(directory: string): boolean {
  return readdirSync(directory, { withFileTypes: true }).some((entry) => {
    if (entry.isDirectory()) {
      return directoryContainsTests(join(directory, entry.name));
    }

    return /\.(test|spec)\.(ts|tsx)$/u.test(entry.name);
  });
}

const plugins = react() as Plugin[];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    typecheck: {
      tsconfig: './tsconfig.vitest.json',
    },
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
      thresholds: hasUnitTests
        ? {
            lines: 20,
            functions: 20,
            statements: 20,
            branches: 10,
          }
        : {
            lines: 0,
            functions: 0,
            statements: 0,
            branches: 0,
          },
    },
  },
});
