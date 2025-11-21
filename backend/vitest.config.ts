import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    // Run in a single worker so Postgres test containers aren't started in parallel
    // which can exhaust CI resources and trigger forced shutdowns mid-test.
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      enabled: true,
      reportsDirectory: './coverage',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
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
