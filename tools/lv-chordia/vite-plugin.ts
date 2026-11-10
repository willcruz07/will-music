import type { Plugin } from 'vite';
import { createReadStream, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** Static experiment assets only. No audio upload, Python process or analysis endpoint. */
export const lvChordiaExperiment = (): Plugin => ({
  name: 'will-music-lv-chordia-experiment',
  apply: 'serve',
  configureServer(server) {
    if (process.env.WM_LV_EXPERIMENT !== '1') return;
    const root = fileURLToPath(new URL('.', import.meta.url));
    const models = join(root, '.cache/export-centered');
    const assets = join(root, '.cache/browser');
    server.middlewares.use('/__lv', (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'GET') { res.statusCode = 405; res.end('O experimento aceita apenas arquivos estáticos.'); return; }
      const route = req.url?.split('?')[0];
      if (route === '/status') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ready: existsSync(join(assets, 'manifest.json')) && Array.from({ length: 5 }, (_, index) => existsSync(join(models, `chordnet-${index}.onnx`))).every(Boolean), browserOnly: true }));
        return;
      }
      const model = /^\/models\/([0-4])\.onnx$/.exec(route ?? '');
      const asset = /^\/assets\/(manifest\.json|dictionary\.json|cqt-(?:[0-9]|[1-9][0-9])\.json)$/.exec(route ?? '');
      if (!model && !asset) { res.statusCode = 404; res.end('Arquivo experimental não encontrado.'); return; }
      const path = model ? join(models, `chordnet-${model[1]}.onnx`) : join(assets, asset![1]!);
      const stream = createReadStream(path);
      res.setHeader('Content-Type', model ? 'application/octet-stream' : 'application/json');
      stream.on('error', () => { if (!res.headersSent) res.statusCode = 404; res.end('Prepare os arquivos experimentais antes de iniciar.'); });
      stream.pipe(res);
    });
  },
});
