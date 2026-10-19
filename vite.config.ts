import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readdirSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// GitHub Pages sert le site sous /<nom-du-repo>/ : sans ce base, écran blanc.
const base = process.env.BASE_PATH ?? '/coral-wiki/';

/**
 * Une fiche = un petit fichier `e/<id>.json` (quelques Ko) : une fiche ouverte par lien direct n'attend plus
 * le fichier complet de son domaine (535 Ko pour les habitants). Générés au build depuis src/data, servis en dev.
 */
const NOT_DOMAINS = new Set(['search', 'meta', 'domaines', 'conflits', 'temple', 'musee', 'rang', 'mines', 'aujourdhui', 'suivi', 'cadeaux', 'icones', 'carte']);
function entities(): Map<string, string> {
  const dir = new URL('./src/data/', import.meta.url);
  const out = new Map<string, string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json') || NOT_DOMAINS.has(f.slice(0, -5))) continue;
    for (const e of JSON.parse(readFileSync(new URL(f, dir), 'utf8'))) out.set(e.id, JSON.stringify({ ...e, dom: f.slice(0, -5) }));
  }
  return out;
}
function entityFiles(): Plugin {
  return {
    name: 'coral-entity-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /\/e\/([a-z0-9-]+)\.json$/.exec(req.url ?? '');
        const e = m && entities().get(m[1]);
        if (!e) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(e);
      });
    },
    generateBundle() {
      for (const [id, json] of entities()) this.emitFile({ type: 'asset', fileName: `e/${id}.json`, source: json });
    },
  };
}

export default defineConfig({
  base,
  json: { stringify: true },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', cssCodeSplit: true, chunkSizeWarningLimit: 1200 },
  plugins: [
    preact(),
    entityFiles(),
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
        theme_color: '#f2f2f6',
        background_color: '#f2f2f6',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Shell + toutes les données (découpées par domaine) précachées : navigation et recherche hors ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // Les fichiers par fiche ne sont pas précachés (les domaines le sont déjà, ils servent de repli hors ligne)
        globIgnores: ['e/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/e/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'fiches', networkTimeoutSeconds: 3, expiration: { maxEntries: 4000 } },
          },
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
