// Ported from Musetric (https://github.com/musetric/musetric), MIT License,
// commit f37b6b1b054e08db0ec4411479b8092524d6dac2:
// packages/cqt/src/cqt/frameCount.es.ts. See THIRD_PARTY_NOTICES.md.
import type { CqtPlan } from './plan.ts';

const assertCount = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
};

export const getDownsampledSampleCount = (sampleCount: number): number => {
  assertCount(sampleCount, 'CQT sampleCount');
  return Math.ceil(sampleCount / 2);
};

export const getOctaveSampleCount = (sampleCount: number, downsampleCount: number): number => {
  assertCount(downsampleCount, 'CQT downsampleCount');
  let result = sampleCount;
  for (let i = 0; i < downsampleCount; i++) result = getDownsampledSampleCount(result);
  return result;
};

export const getCenteredFrameCount = (sampleCount: number, hopLength: number): number => {
  if (!Number.isSafeInteger(hopLength) || hopLength <= 0) throw new RangeError('CQT hopLength must be positive');
  assertCount(sampleCount, 'CQT sampleCount');
  return 1 + Math.floor(sampleCount / hopLength);
};

export const getCqtFrameCount = (
  sampleCount: number,
  plan: Pick<CqtPlan, 'earlyDownsampleCount' | 'octaves'>,
): number => {
  assertCount(sampleCount, 'CQT sampleCount');
  if (sampleCount < 2 ** plan.earlyDownsampleCount) {
    throw new RangeError('CQT input is shorter than the plan early-downsample factor');
  }
  if (plan.octaves.length === 0) throw new RangeError('CQT plan must contain at least one octave');
  let frameCount = Number.POSITIVE_INFINITY;
  for (const octave of plan.octaves) {
    const samples = getOctaveSampleCount(sampleCount, plan.earlyDownsampleCount + octave.index);
    frameCount = Math.min(frameCount, getCenteredFrameCount(samples, octave.hopLength));
  }
  return frameCount;
};
