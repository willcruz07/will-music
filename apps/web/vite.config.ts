import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'will-music',
        short_name: 'will-music',
        description: 'Cifras, acordes e faixas para estudar e tocar.',
        lang: 'pt-BR',
        theme_color: '#10b981',
        background_color: '#f6faf8',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'], maximumFileSizeToCacheInBytes: 40 * 1024 * 1024 },
    }),
  ],
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'] },
});
