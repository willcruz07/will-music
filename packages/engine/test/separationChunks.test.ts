import { describe, expect, it } from 'vitest';
import { createStemAccumulator, deriveStems, planChunks, sliceChunk, toStereoPlanar } from '../src/separation/chunks.ts';

const noise = (n: number) => Float32Array.from({ length: n }, (_, i) => Math.sin(i * 0.37) * Math.cos(i * 0.011));

describe('separation chunks', () => {
  it('rebuilds the input exactly with an identity model, seams included', () => {
    const chunk = 1000;
    const total = 3700;
    const planar = noise(2 * total);
    const plan = planChunks(total, chunk);
    const acc = createStemAccumulator(total, 1);
    plan.forEach((c, i) => acc.add(i, plan, [sliceChunk(planar, total, c.start, chunk)]));
    const [out] = acc.finish();
    let max = 0;
    for (let i = 0; i < planar.length; i++) max = Math.max(max, Math.abs(out![i]! - planar[i]!));
    expect(max).toBeLessThan(1e-5);
  });

  it('plans one chunk for short audio and covers the end', () => {
    expect(planChunks(300, 1000)).toEqual([{ start: 0, length: 300 }]);
    const plan = planChunks(2600, 1000);
    expect(plan.at(-1)!.start + plan.at(-1)!.length).toBe(2600);
    expect(plan[1]!.start).toBe(750);
  });

  it('pads the last chunk with zeros', () => {
    const planar = Float32Array.from([1, 2, 3, 4, 5, 6]); // 2 channels × 3 samples
    expect(Array.from(sliceChunk(planar, 3, 2, 4))).toEqual([3, 0, 0, 0, 6, 0, 0, 0]);
  });

  it('makes mono stereo', () => {
    const { planar, samples } = toStereoPlanar([Float32Array.from([0.1, 0.2])]);
    expect(samples).toBe(2);
    expect(Array.from(planar)).toEqual([0.1, 0.2, 0.1, 0.2].map(Math.fround));
  });

  it('derives instrumental, lead and backing', () => {
    const r = deriveStems(Float32Array.from([1]), Float32Array.from([0.4]), Float32Array.from([0.1]));
    expect(r.instrumental[0]).toBeCloseTo(0.6, 6);
    expect(r.lead[0]).toBeCloseTo(0.3, 6);
    expect(r.backing[0]).toBeCloseTo(0.1, 6);
  });
});
