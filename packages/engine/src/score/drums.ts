export type DrumKind = 'kick' | 'snare' | 'hihat';
export type DrumHit = { time: number; kind: DrumKind };

const lowpass = (x: Float32Array, cutoff: number, sampleRate: number, passes = 2): Float32Array => {
  const a = Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let y = x;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(y.length);
    let s = 0;
    for (let i = 0; i < y.length; i++) {
      s = (1 - a) * y[i]! + a * s;
      out[i] = s;
    }
    y = out;
  }
  return y;
};

const highpass = (x: Float32Array, cutoff: number, sampleRate: number): Float32Array => {
  const low = lowpass(x, cutoff, sampleRate);
  return Float32Array.from(x, (v, i) => v - low[i]!);
};

const energy = (x: Float32Array, from: number, to: number) => {
  let e = 0;
  for (let i = Math.max(0, from); i < Math.min(x.length, to); i++) e += x[i]! * x[i]!;
  return e;
};

/**
 * Finds drum hits in a separated drum track: onsets on the broadband energy, then each onset is
 * classified by where its energy sits (low = kick, mid = snare, high = hi-hat/cymbal). No model:
 * good enough for a basic groove, not for a full kit transcription.
 */
export const detectDrumHits = (audio: Float32Array, sampleRate: number): DrumHit[] => {
  const hop = Math.round(sampleRate * 0.005);
  const win = hop * 2;
  const frames = Math.floor(audio.length / hop);
  const level = new Float32Array(frames);
  for (let f = 0; f < frames; f++) level[f] = 10 * Math.log10(energy(audio, f * hop, f * hop + win) / win + 1e-10);

  const low = lowpass(audio, 150, sampleRate);
  const mid = lowpass(highpass(audio, 1000, sampleRate), 4500, sampleRate);
  const high = highpass(highpass(audio, 7000, sampleRate), 7000, sampleRate);

  const hits: DrumHit[] = [];
  let last = Number.NEGATIVE_INFINITY;
  const minGap = Math.round(0.06 / 0.005);
  for (let f = 3; f < frames - 1; f++) {
    const before = Math.min(level[f - 1]!, level[f - 2]!, level[f - 3]!);
    const rise = level[f]! - before;
    if (level[f]! < -45 || rise < 9 || f - last < minGap) continue;
    // Take the frame where the rise peaks, then classify a 40 ms slice from there.
    if (level[f + 1]! - before > rise + 1) continue;
    last = f;
    const from = f * hop - hop;
    const to = from + Math.round(sampleRate * 0.04);
    const l = energy(low, from, to);
    const m = energy(mid, from, to);
    const h = energy(high, from, to);
    const total = l + m + h + 1e-12;
    const time = (f * hop) / sampleRate;
    if (l / total > 0.6) hits.push({ time, kind: 'kick' });
    else hits.push({ time, kind: h > m ? 'hihat' : 'snare' });
  }
  return hits;
};
