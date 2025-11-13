import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
    deps: {
      optimizer: {
        ssr: {
          include: ['minio'],
        },
      },
    },
    coverage: {
      enabled: false,
    },
  },
});
