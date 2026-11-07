import { describe, expect, it } from 'vitest';
import { getCqtFrameCount } from '../src/cqt/frameCount.ts';
import { verifyCqtPlan } from '../src/cqt/plan.ts';
import { fixtureBytes } from './helpers.ts';

describe('CQT plan', () => {
  it('decodes the ChordMini plan', async () => {
    const plan = await verifyCqtPlan(fixtureBytes('cqt-plan.bin'));
    expect(plan.payloadSha256).toBe('9e233a7935aefc8172b3cead5bea8cbd1379c3f67066de7c8d59137cbc9bba94');
    expect(plan.config).toMatchObject({ sampleRate: 22050, hopLength: 2048, nBins: 144, binsPerOctave: 24, output: 'logMagnitude' });
    expect(plan.config.fmin).toBeCloseTo(32.70319566257483, 10);
    expect(plan.earlyDownsampleCount).toBe(1);
    expect(plan.octaves.map((o) => [o.hopLength, o.fftSize, o.binStart, o.binCount])).toEqual([
      [1024, 512, 120, 24],
      [512, 512, 96, 24],
      [256, 512, 72, 24],
      [128, 512, 48, 24],
      [64, 512, 24, 24],
      [32, 512, 0, 24],
    ]);
    expect(plan.downsample.tapCount).toBe(255);
    expect(plan.fftBins.length).toBe(1818);
  });

  it('rejects a corrupted payload', async () => {
    const bytes = fixtureBytes('cqt-plan.bin');
    const at = bytes.length - 4;
    bytes[at] = bytes[at]! ^ 0xff;
    await expect(verifyCqtPlan(bytes)).rejects.toThrow(/SHA-256/);
  });

  it('counts frames like librosa centered frames', async () => {
    const plan = await verifyCqtPlan(fixtureBytes('cqt-plan.bin'));
    expect(getCqtFrameCount(4096, plan)).toBe(3);
    expect(getCqtFrameCount(22050 * 4, plan)).toBe(1 + Math.floor(44100 / 1024));
  });
});
