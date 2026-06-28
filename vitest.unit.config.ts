import { defineConfig } from 'vitest/config';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
    plugins: [wasm()],
    cacheDir: '.cache/vitest-unit',
    test: {
        environment: 'node',
        fileParallelism: true,
        hookTimeout: 10_000,
        testTimeout: 15_000,
    },
});
