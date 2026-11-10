import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { estimateLvTuning, computeLvFeatures, decodeLvChords } from '../../packages/engine/src/chords/lvBrowser.ts';
const root = new URL('./.cache/', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const floats = async name => { const b = await readFile(new URL(name, root)); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const pcm = await floats('imperfeito-30s.f32');
const reference = await json('browser-audio-report.json');
const started = performance.now();
const tuning = estimateLvTuning(pcm);
assert(Math.abs(tuning - reference.tuning) < 1e-8, `Tuning ${tuning} != ${reference.tuning}`);
const plan = await json(`browser/cqt-${Math.round((tuning + 0.5) * 100)}.json`);
const features = computeLvFeatures(pcm, plan);
const expected = await floats('browser-features-reference.f32');
assert.equal(features.data.length, expected.length);
let maxAbs = 0, square = 0, energy = 0;
for (let i = 0; i < expected.length; i++) {
  const delta = features.data[i] - expected[i];
  maxAbs = Math.max(maxAbs, Math.abs(delta)); square += delta * delta; energy += expected[i] * expected[i];
}
const relativeRms = Math.sqrt(square / energy);
console.log({ tuning, frames: features.frames, maxAbs, relativeRms, cqtMs: performance.now() - started });
assert(relativeRms < 1e-4, 'CQT differs from the Python polyphase reference');
const names = ['triad','bass','seventh','ninth','eleventh','thirteenth'];
const probabilities = await Promise.all(names.map(name => floats(`browser-probabilities-${name}.f32`)));
const candidates = await json('browser/dictionary.json');
const segments = decodeLvChords(probabilities, features.frames, candidates);
assert.deepEqual(segments.map(chord => chord.raw), reference.segments.map(chord => chord.raw));
await writeFile(new URL('browser-validation.json', root), JSON.stringify({ tuning, frames: features.frames, maxAbs, relativeRms, segmentLabelsMatch: true }, null, 2));
console.log(`PASS: browser CQT and decoder; ${segments.length} segments match Python.`);
try {
  const cases = await json('tuning-cases.json');
  for (const item of cases) {
    const signal = await floats(`tuning-${item.index}.pcm`);
    const tuning = estimateLvTuning(signal);
    assert(Math.abs(tuning - item.tuning) < 1e-8, `Tuning case ${item.index}: ${tuning} != ${item.tuning}`);
    const plan = await json(`browser/cqt-${Math.round((tuning + 0.5) * 100)}.json`);
    const actual = computeLvFeatures(signal, plan).data;
    const expected = await floats(`tuning-${item.index}.features`);
    assert.equal(actual.length, expected.length);
    let error = 0, energy = 0;
    for (let i = 0; i < expected.length; i++) { error += (actual[i] - expected[i]) ** 2; energy += expected[i] ** 2; }
    assert(Math.sqrt(error / energy) < 1e-4, `CQT mismatch for tuning ${tuning}`);
    console.log(`PASS: tuning ${tuning}, CQT relative RMS ${Math.sqrt(error / energy)}`);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
