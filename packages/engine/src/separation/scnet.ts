// SCNet Tran Small (ZFTurbo, MIT) exported without its STFT/iSTFT: the app computes them, matching upstream
// SCNet.forward (torch.stft/istft with n_fft 4096, hop 1024, rectangular window, center + reflect, normalized,
// right-padded so the frame count is even before centring). Input `spec` [1, 4, 2049, 476] = [L.re, L.im, R.re, R.im];
// output `out` [1, 16, 2049, 476] = 4 stems (drums, bass, other, vocals) × the same 4 channels.
import { irfft, rfft } from '../cqt/fft.ts';

export const SCNET = {
  SAMPLE_RATE: 44100,
  /** 11 s chunk, the length the model was exported for. */
  SEGMENT: 485100,
  OVERLAP: 0.25,
  INPUT: 'spec',
  OUTPUT: 'out',
  SOURCES: ['drums', 'bass', 'other', 'vocals'] as const,
} as const;

const N_FFT = 4096;
const HOP = 1024;
const BINS = N_FFT / 2 + 1; // 2049
const HALF = N_FFT / 2;
/** Upstream pads so (L + padding) / hop is odd; with 485100 samples that is 1300 → 486400 samples, 476 frames. */
const RIGHT_PAD = (() => {
  let padding = HOP - (SCNET.SEGMENT % HOP);
  if (((SCNET.SEGMENT + padding) / HOP) % 2 === 0) padding += HOP;
  return padding;
})();
const PADDED = SCNET.SEGMENT + RIGHT_PAD;
export const SCNET_FRAMES = PADDED / HOP + 1; // 476
const PLANE = BINS * SCNET_FRAMES;
const SCALE = 1 / Math.sqrt(N_FFT); // torch "normalized": frame_length^-0.5

const reflect = (i: number, length: number): number => {
  if (i < 0) return -i;
  if (i >= length) return 2 * length - 2 - i;
  return i;
};

/** Planar stereo chunk [2 × SEGMENT] → model input [4 × 2049 × 476]. */
export const scnetSpectrum = (planar: Float32Array): Float32Array => {
  const out = new Float32Array(4 * PLANE);
  const signal = new Float32Array(PADDED);
  const frame = new Float32Array(N_FFT);
  const spectrum = new Float32Array(N_FFT + 2);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  for (let c = 0; c < 2; c++) {
    signal.fill(0);
    signal.set(planar.subarray(c * SCNET.SEGMENT, (c + 1) * SCNET.SEGMENT));
    const reBase = (2 * c) * PLANE;
    const imBase = (2 * c + 1) * PLANE;
    for (let t = 0; t < SCNET_FRAMES; t++) {
      for (let n = 0; n < N_FFT; n++) frame[n] = signal[reflect(t * HOP + n - HALF, PADDED)]!;
      rfft(frame, spectrum, re, im);
      for (let k = 0; k < BINS; k++) {
        out[reBase + k * SCNET_FRAMES + t] = spectrum[2 * k]! * SCALE;
        out[imBase + k * SCNET_FRAMES + t] = spectrum[2 * k + 1]! * SCALE;
      }
    }
  }
  return out;
};

/** Model output [16 × 2049 × 476] → four planar stereo stems [2 × SEGMENT] (drums, bass, other, vocals). */
export const scnetStems = (output: Float32Array): Float32Array[] => {
  const spectrum = new Float32Array(N_FFT + 2);
  const frame = new Float32Array(N_FFT);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  const sum = new Float64Array(PADDED + N_FFT);
  // Rectangular window: the overlap-add envelope (Σw²) is the number of frames covering each sample.
  const envelope = new Float64Array(PADDED + N_FFT);
  for (let t = 0; t < SCNET_FRAMES; t++) for (let n = 0; n < N_FFT; n++) envelope[t * HOP + n]! += 1;
  const unscale = Math.sqrt(N_FFT);
  return SCNET.SOURCES.map((_, s) => {
    const stem = new Float32Array(2 * SCNET.SEGMENT);
    for (let c = 0; c < 2; c++) {
      const reBase = (s * 4 + 2 * c) * PLANE;
      const imBase = (s * 4 + 2 * c + 1) * PLANE;
      sum.fill(0);
      for (let t = 0; t < SCNET_FRAMES; t++) {
        for (let k = 0; k < BINS; k++) {
          spectrum[2 * k] = output[reBase + k * SCNET_FRAMES + t]!;
          spectrum[2 * k + 1] = output[imBase + k * SCNET_FRAMES + t]!;
        }
        irfft(spectrum, frame, re, im);
        const start = t * HOP;
        for (let n = 0; n < N_FFT; n++) sum[start + n]! += frame[n]! * unscale;
      }
      const base = c * SCNET.SEGMENT;
      for (let i = 0; i < SCNET.SEGMENT; i++) stem[base + i] = sum[i + HALF]! / Math.max(envelope[i + HALF]!, 1e-8);
    }
    return stem;
  });
};

/** The four SCNet stems in the app's 4-track order (vocals, drums, bass, other). */
export const SCNET_TRACKS = ['vocals', 'drums', 'bass', 'other'] as const;
export const scnetTracks = (stems: Float32Array[]): Float32Array[] =>
  SCNET_TRACKS.map((name) => stems[SCNET.SOURCES.indexOf(name)]!);
