import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lvChordiaExperiment } from '../../tools/lv-chordia/vite-plugin.ts';

// The app version shown in the header comes from this package.json: change "version" there to release a new one.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };


export default defineConfig({
  // Fixed root, so the app also starts when Vite is launched from the repository root (see ../../vite.config.ts).
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    lvChordiaExperiment(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon-48.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'will-music',
        short_name: 'will-music',
        description: 'Cifras, acordes e faixas para estudar e tocar.',
        lang: 'pt-BR',
        id: '/',
        start_url: '/',
        scope: '/',
        theme_color: '#101829',
        // Black like the icon's backdrop, so the splash screen and the icon read as one.
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        categories: ['music', 'education', 'productivity'],
        shortcuts: [
          { name: 'Adicionar música', short_name: 'Adicionar', url: '/nova', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Listas', url: '/listas', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Partituras', url: '/partituras', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpeg,webp,woff2,wasm}'],
        // The WebGPU runtime is only needed to separate tracks: fetch it on first use, then keep it.
        globIgnores: ['**/ort-wasm-simd-threaded.jsep-*.wasm', '**/ort-wasm-simd-threaded.asyncify-*.wasm', '**/ort-wasm-simd-threaded.jspi-*.wasm'],
        runtimeCaching: [{ urlPattern: /\.wasm$/, handler: 'CacheFirst', options: { cacheName: 'wm-runtime-wasm' } }],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
      },
    }),
  ],
  // Hosts that look for the build in a fixed folder (Vercel) pass it as an absolute path.
  build: process.env.WM_OUT_DIR ? { outDir: process.env.WM_OUT_DIR, emptyOutDir: true } : {},
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  test: { environment: 'jsdom', setupFiles: ['./test/setup.ts'] },
});
