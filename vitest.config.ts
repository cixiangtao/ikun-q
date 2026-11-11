import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Delivery snapshots are generated evidence, not additional copies of the source test suite.
    exclude: [...configDefaults.exclude, 'work/**', 'output/**'],
  },
});
