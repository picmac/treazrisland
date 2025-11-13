import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig, type UserConfig } from 'vitest/config';

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

export default defineConfig(
  (async (): Promise<UserConfig> => {
    const { default: react } = await import('@vitejs/plugin-react');

    return {
      plugins: [react()],
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
          enabled: hasUnitTests,
          reporter: ['text', 'json-summary', 'html'],
          reportsDirectory: './coverage',
          include: ['src/app/page.tsx'],
          thresholds: hasUnitTests
            ? {
                lines: 60,
                functions: 60,
                statements: 60,
                branches: 50,
              }
            : {
                lines: 0,
                functions: 0,
                statements: 0,
                branches: 0,
              },
        },
      },
    };
  })()
);
