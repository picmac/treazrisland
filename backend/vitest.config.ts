import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    deps: {
      optimizer: {
        ssr: {
          include: ['minio'],
        },
      },
    },
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      lines: 60,
      functions: 60,
      statements: 60,
      branches: 50,
    },
  },
});
