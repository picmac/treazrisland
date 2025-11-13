import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
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
        enabled: true,
        reporter: ['text', 'json-summary', 'html'],
        reportsDirectory: './coverage',
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
  };
});
