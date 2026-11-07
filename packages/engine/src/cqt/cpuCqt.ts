// CPU implementation of the Musetric CQT shaders (downsample, frame, project);
// see THIRD_PARTY_NOTICES.md. Output matches librosa 0.11 log-CQT for the shipped plan.
import { rfft } from './fft.ts';
import { getCqtFrameCount, getDownsampledSampleCount } from './frameCount.ts';
import type { CqtPlan, HalfBandDownsamplePlan } from './plan.ts';

export type LogCqt = { frameCount: number; binCount: number; data: Float32Array };

const LOG_FLOOR = 1e-6;

const halfBandDownsample = (input: Float32Array, plan: HalfBandDownsamplePlan): Float32Array => {
  const out = new Float32Array(getDownsampledSampleCount(input.length));
  const { tapCount, delay, gain, halfCoefficients } = plan;
  for (let i = 0; i < out.length; i++) {
    const center = 2 * i;
    let value = 0;
    for (let tap = 0; tap < tapCount; tap++) {
      const source = center + tap - delay;
      if (source < 0 || source >= input.length) continue;
      value += input[source]! * halfCoefficients[Math.abs(tap - delay)]!;
    }
    out[i] = value * gain;
  }
  return out;
};

export const computeLogCqt = (pcm22050: Float32Array, plan: CqtPlan): LogCqt => {
  const { nBins } = plan.config;
  const frameCount = getCqtFrameCount(pcm22050.length, plan);
  const data = new Float32Array(frameCount * nBins);
  const levelCount = plan.earlyDownsampleCount + plan.octaves.length - 1;
  const levels: Float32Array[] = [];
  let source = pcm22050;
  for (let level = 0; level < levelCount; level++) {
    source = halfBandDownsample(source, plan.downsample);
    levels.push(source);
  }

  const { rowOffsets, fftBins, coefficients } = plan;
  for (const octave of plan.octaves) {
    const signal = levels[plan.earlyDownsampleCount + octave.index - 1];
    if (!signal) throw new RangeError('CQT plan references a missing downsample level');
    const { fftSize, hopLength, binStart, binCount } = octave;
    const frame = new Float32Array(fftSize);
    const spectrum = new Float32Array(fftSize + 2);
    const re = new Float64Array(fftSize);
    const im = new Float64Array(fftSize);
    for (let f = 0; f < frameCount; f++) {
      const offset = f * hopLength - fftSize / 2;
      for (let s = 0; s < fftSize; s++) {
        const index = offset + s;
        frame[s] = index >= 0 && index < signal.length ? signal[index]! : 0;
      }
      rfft(frame, spectrum, re, im);
      for (let bin = binStart; bin < binStart + binCount; bin++) {
        let sumRe = 0;
        let sumIm = 0;
        for (let j = rowOffsets[bin]!; j < rowOffsets[bin + 1]!; j++) {
          const k = fftBins[j]!;
          const cr = coefficients[2 * j]!;
          const ci = coefficients[2 * j + 1]!;
          const xr = spectrum[2 * k]!;
          const xi = spectrum[2 * k + 1]!;
          sumRe += cr * xr - ci * xi;
          sumIm += cr * xi + ci * xr;
        }
        const magnitude = Math.sqrt(sumRe * sumRe + sumIm * sumIm);
        data[f * nBins + bin] = plan.config.output === 'logMagnitude' ? Math.log(magnitude + LOG_FLOOR) : magnitude;
      }
    }
  }
  return { frameCount, binCount: nBins, data };
};
