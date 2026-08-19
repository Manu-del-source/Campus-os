import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // `server-only` is a Next.js build guard with no runtime behaviour.
      'server-only': path.resolve(__dirname, 'tests/helpers/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['tests/helpers/global-setup.ts'],
    setupFiles: ['tests/helpers/setup-env.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    // Integration suites share one DATABASE_URL and each calls resetDatabase().
    // Parallel workers race TRUNCATE against seedTenant() inserts (FK violations)
    // and can stall hooks until they time out. One worker, one file at a time.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
