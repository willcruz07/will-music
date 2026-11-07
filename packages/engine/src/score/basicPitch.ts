import type { TensorRunner } from '../inference/runner.ts';

// Basic Pitch (Spotify, Apache-2.0) ONNX geometry, from basic_pitch/constants.py and inference.py.
// Tensor names were checked against nmp.onnx with onnxruntime-node.
export const BASIC_PITCH = {
  SAMPLE_RATE: 22050,
  WINDOW: 43844,
  HOP_SAMPLES: 256,
  OVERLAP_FRAMES: 30,
  /** WINDOW minus the overlap (30 frames × 256 samples). */
  HOP: 43844 - 30 * 256,
  FRAMES_PER_WINDOW: 172,
  BINS: 88,
  /** MIDI number of bin 0 (A0). */
  MIDI_OFFSET: 21,
  INPUT: 'serving_default_input_2:0',
  NOTE_OUTPUT: 'StatefulPartitionedCall:1',
  ONSET_OUTPUT: 'StatefulPartitionedCall:2',
} as const;

/** Frame-wise note and onset probabilities, frames × 88, row-major. */
export type Posteriors = { frames: number; note: Float32Array; onset: Float32Array };

/** Runs Basic Pitch over 22050 Hz mono audio in overlapping windows and stitches the central frames. */
export const runBasicPitch = async (
  pcm: Float32Array,
  runner: TensorRunner,
  onProgress?: (done: number, total: number) => void,
): Promise<Posteriors> => {
  const { WINDOW, HOP, FRAMES_PER_WINDOW, BINS, OVERLAP_FRAMES, HOP_SAMPLES } = BASIC_PITCH;
  const pad = (OVERLAP_FRAMES * HOP_SAMPLES) / 2;
  const padded = pcm.length + pad;
  const windows = Math.max(1, Math.ceil(padded / HOP));
  const frames = Math.floor(pcm.length / HOP_SAMPLES);
  const keep = FRAMES_PER_WINDOW - OVERLAP_FRAMES;
  const skip = OVERLAP_FRAMES / 2;
  const note = new Float32Array(frames * BINS);
  const onset = new Float32Array(frames * BINS);
  for (let w = 0; w < windows; w++) {
    const input = new Float32Array(WINDOW);
    const start = w * HOP - pad; // position of input[0] in the original audio
    const from = Math.max(0, start);
    const to = Math.min(pcm.length, start + WINDOW);
    if (to > from) input.set(pcm.subarray(from, to), from - start);
    const out = await runner.run({ [BASIC_PITCH.INPUT]: { data: input, dims: [1, WINDOW, 1] } });
    const n = out[BASIC_PITCH.NOTE_OUTPUT];
    const o = out[BASIC_PITCH.ONSET_OUTPUT];
    if (!n || !o) throw new Error('Basic Pitch não devolveu as saídas esperadas');
    const first = w * keep;
    const count = Math.min(keep, frames - first);
    if (count > 0) {
      note.set(n.subarray(skip * BINS, (skip + count) * BINS), first * BINS);
      onset.set(o.subarray(skip * BINS, (skip + count) * BINS), first * BINS);
    }
    onProgress?.(w + 1, windows);
  }
  return { frames, note, onset };
};
