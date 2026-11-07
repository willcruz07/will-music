import { describe, expect, it } from 'vitest';
import { downmixMean, peakNormalize, prepareAnalysisAudio, resample } from '../src/audio/prepare.ts';
import { dominantFrequency, f32, rms, sine } from './helpers.ts';

describe('audio preparation', () => {
  it('downmixes stereo by arithmetic mean', () => {
    expect(Array.from(downmixMean([f32([1, 0.5]), f32([0, -0.5])]))).toEqual([0.5, 0]);
    expect(Array.from(downmixMean([f32([0.25])]))).toEqual([0.25]);
  });

  it('keeps a 1 kHz tone through 44.1k -> 22.05k', () => {
    const out = resample(sine(1000, 0.5, 44100, 2), 44100, 22050);
    expect(out.length).toBe(44100);
    expect(rms(out.subarray(2000, 42000))).toBeCloseTo(0.5 / Math.SQRT2, 2);
    expect(dominantFrequency(out.subarray(2000, 42000), 22050)).toBeCloseTo(1000, -1);
  });

  it('removes content above the new Nyquist', () => {
    const out = resample(sine(15000, 0.5, 44100, 1), 44100, 22050);
    expect(rms(out.subarray(1000, 21000))).toBeLessThan(0.005);
  });

  it('handles 48k and identity rates', () => {
    expect(resample(sine(440, 0.5, 48000, 1), 48000, 22050).length).toBe(22050);
    const same = sine(440, 0.5, 22050, 1);
    const copy = resample(same, 22050, 22050);
    expect(copy).toEqual(same);
    expect(copy).not.toBe(same);
  });

  it('peak-normalizes without dividing by zero', () => {
    expect(Array.from(peakNormalize(f32([0.25, -0.5])))).toEqual([0.5, -1]);
    expect(Array.from(peakNormalize(f32([0, 0])))).toEqual([0, 0]);
  });

  it('prepares mono 48k audio at 22050 Hz', () => {
    expect(prepareAnalysisAudio([sine(440, 0.5, 48000, 1)], 48000).length).toBe(22050);
  });
});
