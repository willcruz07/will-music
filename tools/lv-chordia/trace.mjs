import { readFile } from 'node:fs/promises';
import * as ort from 'onnxruntime-web/wasm';
const root = new URL('./.cache/export/', import.meta.url);
const floats = async name => { const b = await readFile(new URL(name, root)); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
ort.env.wasm.numThreads = 1;
const session = await ort.InferenceSession.create(new Uint8Array(await readFile(new URL('trace.onnx', root))), { executionProviders: ['wasm'] });
const outputs = await session.run({ features: new ort.Tensor('float32', await floats('features-1292.f32'), [1,1292,252]) });
for (const [name, tensor] of Object.entries(outputs)) {
  const expected = await floats(`trace-${name}.f32`);
  let max = 0, square = 0;
  for (let i = 0; i < expected.length; i++) { const delta = Math.abs(tensor.data[i] - expected[i]); max = Math.max(max, delta); square += delta * delta; }
  console.log(JSON.stringify({ name, maxAbs: max, rms: Math.sqrt(square / expected.length) }));
  tensor.dispose();
}
await session.release();
