import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
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
        'favicon.svg',
        'favicon.ico',
      ],
      manifest: {
        name: 'PomoCare',
        short_name: 'PomoCare',
        description: 'A focus timer for deep work sessions',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#0abab5',
        lang: 'en',
        categories: ['productivity', 'utilities'],
        icons: [
          // PNG icons (required for store submissions)
          { src: 'icons/icon-48x48.png', sizes: '48x48', type: 'image/png' },
          { src: 'icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: 'icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-256x256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          // SVG (scalable fallback)
          { src: 'icons/icon-512x512.svg', sizes: 'any', type: 'image/svg+xml' },
          // Maskable icons (Android adaptive icons)
          { src: 'icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: 'screenshots/01-timer-light-phone.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Timer - Light mode' },
          { src: 'screenshots/02-stats-phone.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Statistics & Analytics' },
          { src: 'screenshots/03-settings-phone.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Settings' },
          { src: 'screenshots/05-timer-dark-phone.png', sizes: '1080x1920', type: 'image/png', form_factor: 'narrow', label: 'Timer - Dark mode' },
          { src: 'screenshots/01-timer-light-desktop.png', sizes: '1920x1080', type: 'image/png', form_factor: 'wide', label: 'Timer - Light mode' },
          { src: 'screenshots/02-stats-desktop.png', sizes: '1920x1080', type: 'image/png', form_factor: 'wide', label: 'Statistics & Analytics' },
          { src: 'screenshots/03-settings-desktop.png', sizes: '1920x1080', type: 'image/png', form_factor: 'wide', label: 'Timer - Dark mode' },
        ],
        shortcuts: [
          {
            name: 'Start Timer',
            short_name: 'Start',
            description: 'Start a focus session',
            url: '/',
            icons: [{ src: 'icons/icon-96x96.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wav,woff2}'],
      },
    }),
  ],
});
