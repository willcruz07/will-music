import { expect, it } from 'vitest';
import { estimateAudioBpm } from '../src/lib/audioTempo.ts';

it('does not invent a tempo for silence or very short audio', () => {
  expect(estimateAudioBpm(new Float32Array(22050), 22050)).toBeUndefined();
  expect(estimateAudioBpm(new Float32Array(0), 22050)).toBeUndefined();
});

it.each([90, 120])('estimates regular pulses near %i BPM', bpm => {
  const rate = 8000;
  const pcm = new Float32Array(rate * 24);
  for (let t = 0; t < 24; t += 60 / bpm) for (let i = 0; i < 160; i++) {
    const index = Math.round(t * rate) + i;
    if (index < pcm.length) pcm[index] = Math.sin(i * 0.7) * Math.exp(-i / 45);
  }
  expect(estimateAudioBpm(pcm, rate)).toBeCloseTo(bpm, -1);
});
