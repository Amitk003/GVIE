import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/setup-tests.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
