import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/pomocare/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/*.svg',
        'icons/*.png',
        'sounds/notification.wav',
        'favicon.svg',
        'favicon.ico',
      ],
      manifest: {
        name: 'PomoCare',
        short_name: 'PomoCare',
        description: 'A focus timer for deep work sessions',
        start_url: '/pomocare/',
        scope: '/pomocare/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f9fafb',
        theme_color: '#0abab5',
        lang: 'en',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'icons/icon-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-maskable-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wav,woff2}'],
      },
    }),
  ],
});
