import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      enabled: true,
      reportsDirectory: './coverage',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      lines: 60,
      functions: 60,
      statements: 60,
      branches: 50,
    },
    deps: {
      optimizer: {
        ssr: {
          include: ['minio'],
        },
      },
    },
  },
});
