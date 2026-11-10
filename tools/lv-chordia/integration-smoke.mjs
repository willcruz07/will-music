// Run with: node --import tsx tools/lv-chordia/integration-smoke.mjs
// Requires the existing local audio fixture; does not upload audio or change the library.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MODELS } from '../../packages/engine/src/index.ts';
import { createLvAnalyzer } from '../../apps/web/src/lib/lvInference.ts';
import { analyzeLvSong } from '../../apps/web/src/lib/lvSong.ts';
const bytes = await readFile(new URL('./.cache/imperfeito-30s.f32', import.meta.url));
const pcm = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const assets = new Map();
const analyze = await createLvAnalyzer(async (id) => {
  if (!assets.has(id)) {
    const asset = MODELS[id];
    const bytes = new Uint8Array(await readFile(new URL('../../apps/web/public' + asset.url, import.meta.url)));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assets.set(id, bytes);
  }
  return assets.get(id);
});
const started = performance.now();
const clip = await analyze(pcm);
const reference = JSON.parse(await readFile(new URL('./.cache/audio-report.json', import.meta.url), 'utf8'));
assert.deepEqual(clip.map(c => c.raw), reference.segments.map(c => c.raw));
const song = new Float32Array(65 * 22050);
for (let i = 0; i < song.length; i++) song[i] = pcm[i % pcm.length];
const result = await analyzeLvSong(song, (block) => analyze(block), (done, total) => console.log(done + '/' + total));
assert(result.length > 0);
assert.equal(result[0].start, 0);
assert.equal(result.at(-1).end, 65);
for (let i = 1; i < result.length; i++) assert(Math.abs(result[i].start - result[i - 1].end) < 1e-6);
const report = { seconds: (performance.now() - started) / 1000, segments: result, scope: 'Real WASM inference on local fixture, 65-second repeated audio, bounded production orchestration under Node; no browser/mobile timing claim' };
await writeFile(new URL('./.cache/integration-smoke.json', import.meta.url), JSON.stringify(report, null, 2));
console.log('PASS: reference labels, complete 65-second coverage, contiguous boundaries; ' + report.seconds.toFixed(2) + ' seconds.');

// Exercise the standard analysis worker, including SKey, protocol and download cache.
const store = new Map();
const fetched = [];
globalThis.caches = { open: async () => ({
  match: async url => store.get(url)?.clone(),
  put: async (url, response) => store.set(url, new Response(await response.arrayBuffer())),
  delete: async url => store.delete(url),
}) };
globalThis.fetch = async url => {
  fetched.push(url);
  const id = Object.keys(MODELS).find(id => MODELS[id].url === url);
  if (!id) throw new Error('Unexpected network request: ' + url);
  const file = id === 'skey' ? new URL('../phase0/.cache/models/skey.onnx', import.meta.url) : new URL('../../apps/web/public' + url, import.meta.url);
  return new Response(await readFile(file));
};
let workerResult;
globalThis.self = { postMessage: message => {
  if (message.type !== 'progress') workerResult = message;
} };
await import('../../apps/web/src/worker/analysis.worker.ts');
await self.onmessage({ data: { type: 'analyze', channels: [song] } });
assert.equal(workerResult.type, 'result', workerResult.message);
assert.equal(workerResult.chords.at(-1).end, 65);
assert(workerResult.models.chordDecoder.startsWith('lv-'));
assert(workerResult.models.key.startsWith('skey.onnx'));
assert.equal(fetched.length, 8);
assert(!fetched.some(url => url === MODELS.chordnet.url));
await writeFile(new URL('./.cache/standard-worker-smoke.json', import.meta.url), JSON.stringify(workerResult, null, 2));
console.log('PASS: standard worker protocol, LV + SKey, 8 files fetched once, no legacy chord model.');
