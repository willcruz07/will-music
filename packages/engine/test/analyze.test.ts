import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeChords, analyzeKey } from '../src/analyze.ts';
import { getCqtFrameCount } from '../src/cqt/frameCount.ts';
import { type CqtPlan, verifyCqtPlan } from '../src/cqt/plan.ts';
import type { TensorRunner } from '../src/inference/runner.ts';
import { decodeKey } from '../src/key/key.ts';
import { f32, fixtureBytes, sine } from './helpers.ts';

let plan: CqtPlan;
beforeAll(async () => {
  plan = await verifyCqtPlan(fixtureBytes('cqt-plan.bin'));
});

const constantChordRunner = (index: number, calls: number[][] = []): TensorRunner => ({
  async run(feeds) {
    calls.push([...feeds.features!.dims]);
    const out = new Float32Array(16 * 108 * 170);
    for (let f = 0; f < 16 * 108; f++) out[f * 170 + index] = 5;
    return { logits: out };
  },
  async release() {},
});

describe('analysis', () => {
  it('feeds ChordMini in groups of [16,108,144] and trims padding', async () => {
    const calls: number[][] = [];
    const segs = await analyzeChords(sine(220, 0.5, 22050, 30), plan, constantChordRunner(1, calls));
    expect(calls).toEqual([[16, 108, 144]]);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ raw: 'C', start: 0 });
    expect(segs[0]!.end).toBeCloseTo((getCqtFrameCount(22050 * 30, plan) * 2048) / 22050, 2);
  });

  it('reports progress per run', async () => {
    const seen: [number, number][] = [];
    await analyzeChords(sine(220, 0.5, 22050, 170), plan, constantChordRunner(1), (d, t) => seen.push([d, t]));
    expect(seen).toEqual([[1, 2], [2, 2]]);
  });

  it('returns no chord segments for empty audio', async () => {
    const calls: number[][] = [];
    expect(await analyzeChords(new Float32Array(0), plan, constantChordRunner(169, calls))).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('labels silence as no chord', async () => {
    const segs = await analyzeChords(new Float32Array(22050), plan, constantChordRunner(169));
    expect(segs.map((s) => s.raw)).toEqual(['N']);
  });

  it('decodes the key with margin', () => {
    const p = new Float32Array(24);
    p[3] = 0.1;
    p[22] = 0.06;
    const k = decodeKey(p);
    expect(k).toMatchObject({ root: 'C', mode: 'major', label: 'C major', index: 3 });
    expect(k.margin).toBeCloseTo(0.04, 5);
    expect(decodeKey(Float32Array.from({ length: 24 }, (_, i) => (i === 22 ? 1 : 0))).label).toBe('A minor');
  });

  it('peak-normalizes before S-KEY and feeds [1, N]', async () => {
    let seen: { data: Float32Array; dims: readonly number[] } | undefined;
    const fake: TensorRunner = {
      async run(feeds) {
        seen = feeds.audio;
        const p = new Float32Array(24);
        p[0] = 1;
        return { probs: p };
      },
      async release() {},
    };
    expect((await analyzeKey(f32([0.1, -0.2]), fake)).label).toBe('A major');
    expect(seen!.dims).toEqual([1, 2]);
    expect(Array.from(seen!.data)).toEqual([0.5, -1]);
  });

  it('does not produce NaN on silent key input', async () => {
    let data: Float32Array | undefined;
    const fake: TensorRunner = { async run(f) { data = f.audio!.data; return { probs: new Float32Array(24).fill(1 / 24) }; }, async release() {} };
    await analyzeKey(new Float32Array(100), fake);
    expect(data!.some(Number.isNaN)).toBe(false);
  });
});
