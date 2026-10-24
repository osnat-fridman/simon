import { defineConfig } from 'vitest/config';

// Base path matches the GitHub Pages project URL (/<repository>/).
export default defineConfig({
  base: '/simon/',
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
