/**
 * Vitest configuration.
 * Sets longer timeouts for DB-backed integration tests against Neon.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
