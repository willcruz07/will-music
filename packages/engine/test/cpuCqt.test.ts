import { beforeAll, describe, expect, it } from 'vitest';
import { computeLogCqt, type LogCqt } from '../src/cqt/cpuCqt.ts';
import { type CqtPlan, verifyCqtPlan } from '../src/cqt/plan.ts';
import { fixtureBytes, sine } from './helpers.ts';

let plan: CqtPlan;
beforeAll(async () => {
  plan = await verifyCqtPlan(fixtureBytes('cqt-plan.bin'));
});

const row = (r: LogCqt, frame: number): Float32Array => r.data.subarray(frame * r.binCount, (frame + 1) * r.binCount);
const peakBin = (values: Float32Array): number => {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i]! > values[best]!) best = i;
  return best;
};
const fmin = 32.70319566257483;

// librosa 0.11 reference magnitudes (Musetric packages/cqt/src/cqt/__test__/reference.ts)
const refs: [number, number][] = [
  [0, 38.211262], [12, 32.11541], [23, 27.398172], [24, 27.019209], [47, 19.373188], [48, 19.105656],
  [71, 13.699096], [72, 13.50953], [95, 9.686647], [96, 9.552778], [119, 6.849493], [120, 6.754834], [143, 4.843322],
];

describe('CPU CQT', () => {
  it('silence goes to the log floor', () => {
    const r = computeLogCqt(new Float32Array(4096), plan);
    expect(r.frameCount).toBe(3);
    expect(r.binCount).toBe(144);
    for (const v of r.data) expect(v).toBeCloseTo(Math.log(1e-6), 5);
  });

  it.each(refs)('tone at bin %i peaks there with the librosa magnitude', (bin, peak) => {
    const r = computeLogCqt(sine(fmin * 2 ** (bin / 24), 0.5, 22050, 4), plan);
    for (let f = 2; f < r.frameCount - 2; f++) expect(peakBin(row(r, f)), `frame ${f}`).toBe(bin);
    const mid = row(r, Math.floor(r.frameCount / 2));
    expect(Math.exp(mid[bin]!) - 1e-6).toBeCloseTo(peak, 2);
  });

  it('is linear in amplitude', () => {
    const a = computeLogCqt(sine(fmin * 2 ** 3, 0.25, 22050, 4), plan);
    const b = computeLogCqt(sine(fmin * 2 ** 3, 0.5, 22050, 4), plan);
    const f = Math.floor(a.frameCount / 2);
    expect(Math.exp(row(b, f)[72]!)).toBeCloseTo(2 * Math.exp(row(a, f)[72]!), 1);
  });

  it('handles input shorter than one hop', () => {
    expect(computeLogCqt(new Float32Array(100), plan).frameCount).toBe(1);
  });
});
