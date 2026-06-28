import { defineConfig } from 'vitest/config';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [wasm()],
  cacheDir: '.cache/vitest',
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 180_000,
  },
});
