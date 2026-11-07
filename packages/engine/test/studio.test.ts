import { describe, expect, it } from 'vitest';
import { computePeaks } from '../src/audio/peaks.ts';
import { planChunks, sliceChunk } from '../src/separation/chunks.ts';
import { DEMUCS, STEM_MODES, demucsTracks } from '../src/separation/demucs.ts';
import { createStreamingAccumulator } from '../src/separation/streaming.ts';
import { detectDrumHits } from '../src/score/drums.ts';

const noise = (n: number, seed = 1) => {
  let s = seed;
  return Float32Array.from({ length: n }, () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  });
};

describe('streaming accumulator', () => {
  it('rebuilds the input exactly with an identity model, emitting contiguous regions', () => {
    const chunk = 1000;
    const total = 3700;
    const planar = Float32Array.from({ length: 2 * total }, (_, i) => Math.sin(i * 0.37) * Math.cos(i * 0.011));
    const plan = planChunks(total, chunk);
    const acc = createStreamingAccumulator(plan, total, 1);
    const out = new Float32Array(2 * total);
    let next = 0;
    plan.forEach((c, i) => {
      const region = acc.add(i, [sliceChunk(planar, total, c.start, chunk)]);
      expect(region.from).toBe(next);
      const len = region.to - region.from;
      for (let ch = 0; ch < 2; ch++) out.set(region.stems[0]!.subarray(ch * len, (ch + 1) * len), ch * total + region.from);
      next = region.to;
    });
    expect(next).toBe(total);
    let max = 0;
    for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]! - planar[i]!));
    expect(max).toBeLessThan(1e-5);
  });

  it('handles audio shorter than one chunk', () => {
    const plan = planChunks(300, 1000);
    const acc = createStreamingAccumulator(plan, 300, 2);
    const chunk = new Float32Array(2000).fill(0.5);
    const region = acc.add(0, [chunk, chunk]);
    expect(region).toMatchObject({ from: 0, to: 300 });
    expect(region.stems[1]!.length).toBe(600);
    expect(region.stems[1]![599]).toBeCloseTo(0.5, 6);
  });
});

describe('demucs modes', () => {
  const N = 4;
  // Model output [6 sources × 2 channels × N]: source k holds the value k+1.
  const output = Float32Array.from({ length: 6 * 2 * N }, (_, i) => Math.floor(i / (2 * N)) + 1);

  it('lists the tracks of every mode', () => {
    expect(STEM_MODES.vocals.tracks).toEqual(['instrumental', 'lead', 'backing']);
    expect(STEM_MODES.four.tracks).toEqual(['vocals', 'drums', 'bass', 'other']);
    expect(STEM_MODES.six.tracks).toEqual(['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']);
    expect(STEM_MODES.full.tracks).toEqual(['lead', 'backing', 'drums', 'bass', 'guitar', 'piano', 'other']);
    expect(DEMUCS.SOURCES).toEqual(['drums', 'bass', 'other', 'vocals', 'guitar', 'piano']);
  });

  it('folds guitar and piano into "other" for four stems', () => {
    const t = demucsTracks('four', output, N);
    expect(t.map((x) => x[0])).toEqual([4, 1, 2, 3 + 5 + 6]);
    expect(t[0]!.length).toBe(2 * N);
  });

  it('keeps every source for six stems and drops vocals in the full mode', () => {
    expect(demucsTracks('six', output, N).map((x) => x[N])).toEqual([4, 1, 2, 5, 6, 3]);
    expect(demucsTracks('full', output, N).map((x) => x[0])).toEqual([1, 2, 5, 6, 3]);
  });
});

describe('drum hits', () => {
  const sr = 44100;
  const place = (out: Float32Array, at: number, sound: Float32Array) => out.set(sound.subarray(0, Math.min(sound.length, out.length - at)), at);
  const kick = Float32Array.from({ length: 6000 }, (_, i) => Math.sin((2 * Math.PI * 55 * i) / sr) * Math.exp(-i / 2500) * 0.9);
  const snare = (() => {
    const n = noise(5000, 7);
    // Mid-band noise: difference of a smoothed noise (keeps 1–5 kHz, little very-high content).
    let s = 0;
    return Float32Array.from(n, (v, i) => {
      s += 0.35 * (v - s);
      return s * Math.exp(-i / 1500) * 2.5;
    });
  })();
  const hat = (() => {
    const n = noise(1500, 3);
    return Float32Array.from(n, (v, i) => (v - (n[i - 1] ?? 0)) * Math.exp(-i / 300) * 0.6);
  })();

  it('finds kick, snare and hi-hat at their times', () => {
    const audio = new Float32Array(sr * 3);
    place(audio, Math.round(0.5 * sr), kick);
    place(audio, Math.round(1.0 * sr), snare);
    place(audio, Math.round(1.5 * sr), hat);
    place(audio, Math.round(2.0 * sr), kick);
    const hits = detectDrumHits(audio, sr);
    const at = (kind: string) => hits.filter((h) => h.kind === kind).map((h) => Math.round(h.time * 10) / 10);
    expect(at('kick')).toEqual([0.5, 2]);
    expect(at('snare')).toEqual([1]);
    expect(at('hihat')).toEqual([1.5]);
  });

  it('returns nothing for silence', () => {
    expect(detectDrumHits(new Float32Array(sr), sr)).toEqual([]);
  });
});

describe('waveform peaks', () => {
  it('summarises the signal into columns of peak amplitude', () => {
    const audio = new Float32Array(1000);
    audio.fill(0.25, 0, 500);
    audio[700] = -0.9;
    const peaks = computePeaks(audio, 10);
    expect(peaks).toHaveLength(10);
    expect(peaks[0]).toBeCloseTo(0.25);
    expect(peaks[7]).toBeCloseTo(0.9);
    expect(peaks[9]).toBe(0);
  });
});
