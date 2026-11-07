import { describe, expect, it } from 'vitest';
import { SEPARATION_GEOMETRY as G, applyMasks, istftChunk, stftChunk } from '../src/separation/stft.ts';

const noise = (n: number, seed = 7) => {
  let s = seed;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return out;
};

describe('separation STFT', () => {
  it('has the model geometry', () => {
    expect(G).toMatchObject({ nFft: 2048, hop: 441, frames: 1100, channels: 2, chunkSamples: 441 * 1099, sampleRate: 44100 });
  });

  it('reconstructs the input', () => {
    const x = noise(2 * G.chunkSamples);
    const y = istftChunk(stftChunk(x));
    let max = 0;
    for (let i = 0; i < x.length; i++) max = Math.max(max, Math.abs(x[i]! - y[i]!));
    expect(max).toBeLessThan(1e-4);
  });

  it('packs channels into interleaved frequency rows', () => {
    const x = new Float32Array(2 * G.chunkSamples);
    for (let i = 0; i < G.chunkSamples; i++) x[G.chunkSamples + i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 44100);
    const s = stftChunk(x);
    const energy = (packed: number) => {
      let e = 0;
      for (let f = 0; f < G.frames; f++) {
        const o = (packed * G.frames + f) * 2;
        e += s[o]! ** 2 + s[o + 1]! ** 2;
      }
      return e;
    };
    expect(s.length).toBe(2050 * 1100 * 2);
    expect(energy(93)).toBeGreaterThan(1000 * energy(92));
  });

  it('applies chained complex masks', () => {
    const s = stftChunk(noise(2 * G.chunkSamples));
    const ones = new Float32Array(s.length * 2);
    const half = new Float32Array(s.length * 2);
    for (let i = 0; i < ones.length; i += 2) {
      ones[i] = 1;
      half[i] = 0.5;
    }
    expect(applyMasks(s, ones, 1)).toEqual(s);
    expect(Math.max(...applyMasks(s, new Float32Array(s.length * 2), 1).subarray(0, 1000).map(Math.abs))).toBe(0);
    const quarter = applyMasks(s, half, 2);
    expect(quarter[10]).toBeCloseTo(0.25 * s[10]!, 5);
  });
});
