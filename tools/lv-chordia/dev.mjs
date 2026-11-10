import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

process.env.WM_LV_EXPERIMENT = '1';
const server = await createServer({
  configFile: fileURLToPath(new URL('../../apps/web/vite.config.ts', import.meta.url)),
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
});
await server.listen();
server.printUrls();
console.log('LV-Chordia: análise 100% no navegador; servidor fornece somente modelos e filtros estáticos.');
