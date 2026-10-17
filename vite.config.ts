import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages sert le site sous /<nom-du-repo>/ : sans ce base, écran blanc.
const base = process.env.BASE_PATH ?? '/coral-wiki/';

export default defineConfig({
  base,
  json: { stringify: true },
  build: { target: 'es2022', cssCodeSplit: true, chunkSizeWarningLimit: 1200 },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Coral Wiki — compagnon Coral Island',
        short_name: 'Coral Wiki',
        description: 'Wiki hors ligne de Coral Island : cultures, poissons, PNJ, temple, musée, trackers.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b5f63',
        background_color: '#f6f1e7',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Shell + toutes les données (découpées par domaine) précachées : navigation et recherche hors ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Illustrations du jeu (CDN Fandom / Steam) : cache-first, chargées à la demande.
            urlPattern: ({ url }) => /(^|\.)(wikia\.nocookie\.net|steamstatic\.com)$/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-jeu',
              expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 180, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
