import { peakNormalize } from './audio/prepare.ts';
import { type ChordSegment, buildChordSegments, smoothArgmax, windowFeatures } from './chords/decode.ts';
import { computeLogCqt } from './cqt/cpuCqt.ts';
import type { CqtPlan } from './cqt/plan.ts';
import type { TensorRunner } from './inference/runner.ts';
import { type KeyResult, decodeKey } from './key/key.ts';

export const chordMiniGraph = {
  inputName: 'features',
  outputName: 'logits',
  seqLen: 108,
  windowsPerRun: 16,
  bins: 144,
  chordCount: 170,
  frameDuration: 2048 / 22050,
  smoothingRadius: 4,
} as const;

export const skeyGraph = { inputName: 'audio', outputName: 'probs' } as const;

export const analyzeChords = async (
  pcm22050: Float32Array,
  plan: CqtPlan,
  runner: TensorRunner,
  onProgress?: (done: number, total: number) => void,
): Promise<ChordSegment[]> => {
  if (pcm22050.length < 2 ** plan.earlyDownsampleCount) return [];
  const g = chordMiniGraph;
  const cqt = computeLogCqt(pcm22050, plan);
  const runs = windowFeatures(cqt, g.seqLen, g.windowsPerRun);
  const runFrames = g.windowsPerRun * g.seqLen;
  const logits = new Float32Array(runs.length * runFrames * g.chordCount);
  for (let r = 0; r < runs.length; r++) {
    const out = await runner.run({ [g.inputName]: { data: runs[r]!, dims: [g.windowsPerRun, g.seqLen, g.bins] } });
    const values = out[g.outputName];
    if (!values || values.length !== runFrames * g.chordCount) throw new Error('ChordMini returned logits of an unexpected size');
    logits.set(values, r * runFrames * g.chordCount);
    onProgress?.(r + 1, runs.length);
  }
  const indices = smoothArgmax(logits, cqt.frameCount, g.seqLen, g.chordCount, g.smoothingRadius);
  return buildChordSegments(indices, g.frameDuration);
};

export const analyzeKey = async (pcm22050: Float32Array, runner: TensorRunner): Promise<KeyResult> => {
  const audio = peakNormalize(pcm22050);
  const out = await runner.run({ [skeyGraph.inputName]: { data: audio, dims: [1, audio.length] } });
  const probs = out[skeyGraph.outputName];
  if (!probs) throw new Error('S-KEY did not return probabilities');
  return decodeKey(probs);
};
