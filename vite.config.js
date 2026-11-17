import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { lobbyVitePlugin } from './server/wsPlugin.js';

export default defineConfig({
  plugins: [
    react(),
    lobbyVitePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/favicon-32.png',
        'icons/apple-touch-icon.png',
        'icons/mascot.png',
        'data/dictionary-en-it.json',
        'data/LICENSE-FREEDICT.txt',
      ],
      manifest: {
        id: '/',
        name: 'ThE InGliSc GaMe',
        short_name: 'InGliSc',
        description:
          'Party game di parole inglesi per 3 giocatori: bluff, scarti, battito della mano sulla superficie e vocabolario appreso.',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#0D92F4',
        background_color: '#F4F6FF',
        categories: ['games', 'education'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/sw\.js$/, /^\/workbox-.*\.js$/, /^\/api\//, /^\/ws/],
      },
    }),
  ],
});
