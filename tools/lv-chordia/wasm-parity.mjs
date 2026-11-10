// Exercise the app's actual WASM provider under Node, without requiring a browser or changing app routes.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-web/wasm';

const directory = new URL(`./.cache/${process.env.LV_CENTERED === '1' ? 'export-centered' : 'export'}/`, import.meta.url);
const referenceDirectory = new URL('./.cache/export/', import.meta.url);
const heads = ['triad', 'bass', 'seventh', 'ninth', 'eleventh', 'thirteenth'];
const floats = async (name) => {
  const data = await readFile(new URL(name, referenceDirectory));
  return new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
};
ort.env.wasm.numThreads = 1; // Same fallback used in the app without cross-origin isolation.
const started = performance.now();
const session = await ort.InferenceSession.create(new Uint8Array(await readFile(new URL('chordnet-0.onnx', directory))), {
  executionProviders: ['wasm'], graphOptimizationLevel: process.env.LV_DISABLE_OPT === '1' ? 'disabled' : 'all',
});
const report = { provider: 'onnxruntime-web/wasm under Node (not a mobile/browser benchmark)', threads: 1, loadMs: performance.now() - started, cases: [] };
try {
  const cases = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [96, 192];
  for (const frames of cases) {
    const input = new ort.Tensor('float32', await floats(`features-${frames}.f32`), [1, frames, 252]);
    const begin = performance.now();
    const outputs = await session.run({ features: input });
    const result = { frames, inferenceMs: performance.now() - begin, heads: {} };
    try {
      for (const name of heads) {
        const expected = await floats(`reference-${frames}-${name}.f32`);
        const actual = outputs[name];
        if (!actual || actual.data.length !== expected.length) throw new Error(`Wrong shape for ${name}`);
        let maxAbs = 0;
        let mismatches = 0;
        let agreements = 0;
        for (let i = 0; i < expected.length; i++) {
          const delta = Math.abs(actual.data[i] - expected[i]);
          maxAbs = Math.max(maxAbs, delta);
          if (!Number.isFinite(delta) || delta > 1e-4 + Math.abs(expected[i]) * 1e-3) mismatches++;
        }
        const width = actual.dims.at(-1);
        for (let row = 0; row < frames; row++) {
          let bestExpected = 0;
          let bestActual = 0;
          for (let column = 1; column < width; column++) {
            if (expected[row * width + column] > expected[row * width + bestExpected]) bestExpected = column;
            if (actual.data[row * width + column] > actual.data[row * width + bestActual]) bestActual = column;
          }
          if (bestExpected === bestActual) agreements++;
        }
        result.heads[name] = { dims: actual.dims, maxAbsError: maxAbs, mismatches, argmaxAgreement: agreements / frames };
      }
      report.cases.push(result);
    } finally {
      input.dispose();
      for (const tensor of Object.values(outputs)) tensor.dispose();
    }
  }
} finally {
  await session.release();
}
report.passed = report.cases.every((item) => Object.values(item.heads).every((head) => head.mismatches === 0));
const target = new URL(`./.cache/wasm-report-${report.cases.map((item) => item.frames).join('-')}${process.env.LV_CENTERED === '1' ? '-centered' : ''}${process.env.LV_DISABLE_OPT === '1' ? '-no-opt' : ''}.json`, import.meta.url);
await writeFile(target, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`Report: ${fileURLToPath(target)}`);
if (!report.passed) process.exitCode = 1;
