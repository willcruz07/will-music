import { estimateTempo } from '@will-music/engine';

/** Lightweight onset estimate from at most two minutes of already-decoded mono audio. */
export const estimateAudioBpm = (pcm: Float32Array, sampleRate: number): number | undefined => {
  if (!pcm.length || sampleRate <= 0) return undefined;
  const hop = Math.max(1, Math.round(sampleRate / 100));
  const duration = pcm.length / sampleRate;
  const start = Math.floor(Math.min(20, duration * 0.1) * sampleRate);
  const frames = Math.floor(Math.min(pcm.length - start, sampleRate * 120) / hop);
  const energy = new Float32Array(frames);
  const novelty = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let j = 0; j < hop; j++) { const value = pcm[start + i * hop + j]!; sum += value * value; }
    energy[i] = Math.sqrt(sum / hop);
    novelty[i] = Math.max(0, energy[i]! - (energy[i - 1] ?? 0));
  }
  let rolling = 0;
  let last = -100;
  const onsets: number[] = [];
  for (let i = 1; i < frames - 1; i++) {
    rolling += novelty[i]!;
    if (i >= 50) rolling -= novelty[i - 50]!;
    const threshold = Math.max(0.002, rolling / Math.min(i + 1, 50) * 2);
    if (novelty[i]! > threshold && novelty[i]! >= novelty[i - 1]! && novelty[i]! > novelty[i + 1]! && i - last >= 18) {
      onsets.push(i * hop / sampleRate); last = i;
    }
  }
  return onsets.length >= 8 ? estimateTempo(onsets) : undefined;
};
