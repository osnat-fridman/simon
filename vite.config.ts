import { readFileSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const BASE = '/simon/';
const BG_COLOR = '#070B26';

// Build id marks which version is running (used by the PWA update tests).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};
const BUILD_ID = process.env.SIMON_BUILD_ID ?? pkg.version;

// Base path matches the GitHub Pages project URL (/<repository>/).
export default defineConfig({
  base: BASE,
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    VitePWA({
      strategies: 'generateSW',
      // No update dialog and no forced reload: a new version waits until old tabs close.
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      // Icons and favicon are already matched by globPatterns below.
      includeManifestIcons: false,
      manifest: {
        id: BASE,
        start_url: BASE,
        scope: BASE,
        name: 'סיימון',
        short_name: 'סיימון',
        description: 'סיימון – משחק זיכרון עם אורות וצלילים',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        background_color: BG_COLOR,
        theme_color: BG_COLOR,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // woff2 only: every supported browser uses it, so woff copies would be dead weight.
        globPatterns: ['**/*.{html,js,css,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
