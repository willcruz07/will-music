/**
 * YIN pitch detection (de Cheveigné & Kawahara, 2002): the period is the first dip of the cumulative
 * mean normalized difference below a threshold, refined by parabolic interpolation.
 */
export const detectPitch = (
  frame: Float32Array,
  sampleRate: number,
  opts: { threshold?: number; minHz?: number; maxHz?: number; minRms?: number } = {},
): { hz: number; clarity: number } | null => {
  const { threshold = 0.12, minHz = 50, maxHz = 1600, minRms = 0.01 } = opts;
  let energy = 0;
  for (const v of frame) energy += v * v;
  if (Math.sqrt(energy / frame.length) < minRms) return null;
  const maxLag = Math.min(Math.floor(sampleRate / minHz), Math.floor(frame.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const window = frame.length - maxLag;
  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const diff = frame[i]! - frame[i + lag]!;
      sum += diff * diff;
    }
    d[lag] = sum;
  }
  // Cumulative mean normalized difference.
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag]!;
    cmnd[lag] = running > 0 ? (d[lag]! * lag) / running : 1;
  }
  let lag = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t]! < threshold) {
      while (t + 1 <= maxLag && cmnd[t + 1]! < cmnd[t]!) t++;
      lag = t;
      break;
    }
  }
  if (lag < 0) return null;
  const a = cmnd[lag - 1] ?? cmnd[lag]!;
  const b = cmnd[lag]!;
  const c = cmnd[lag + 1] ?? cmnd[lag]!;
  const denom = a - 2 * b + c;
  const refined = denom !== 0 ? lag + (a - c) / (2 * denom) : lag;
  return { hz: sampleRate / refined, clarity: 1 - b };
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

/** Nearest equal-tempered note for a frequency, and how many cents (−50…+50) it is off. */
export const noteOf = (hz: number, a4 = 440): { midi: number; name: string; solfege: string; octave: number; cents: number } => {
  const exact = 69 + 12 * Math.log2(hz / a4);
  const midi = Math.round(exact);
  const pc = ((midi % 12) + 12) % 12;
  return { midi, name: NAMES[pc]!, solfege: SOLFEGE[pc]!, octave: Math.floor(midi / 12) - 1, cents: Math.round((exact - midi) * 100) };
};

export const midiName = (midi: number): string => `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

export type VoiceType = 'baixo' | 'baritono' | 'tenor' | 'contralto' | 'mezzo' | 'soprano';

/** Usual comfortable ranges (MIDI) of each voice in choir writing. */
export const VOICE_RANGES: Record<VoiceType, { low: number; high: number; label: string }> = {
  baixo: { low: 40, high: 62, label: 'Baixo' },
  baritono: { low: 43, high: 65, label: 'Barítono' },
  tenor: { low: 48, high: 69, label: 'Tenor' },
  contralto: { low: 53, high: 74, label: 'Contralto' },
  mezzo: { low: 57, high: 77, label: 'Mezzo-soprano' },
  soprano: { low: 60, high: 81, label: 'Soprano' },
};

/**
 * Suggests a voice type from sung pitches (MIDI, fractional allowed): the range whose ends best match
 * the 10th and 90th percentiles of what was sung. A suggestion from range only, not a vocal assessment.
 */
export const voiceType = (pitches: readonly number[]): { type: VoiceType; label: string; low: number; high: number } | null => {
  if (pitches.length < 12) return null;
  const sorted = [...pitches].sort((a, z) => a - z);
  const low = sorted[Math.floor(sorted.length * 0.1)]!;
  const high = sorted[Math.floor(sorted.length * 0.9)]!;
  let best: VoiceType = 'tenor';
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [type, r] of Object.entries(VOICE_RANGES) as [VoiceType, (typeof VOICE_RANGES)[VoiceType]][]) {
    const score = Math.abs(low - (r.low + 2)) + Math.abs(high - (r.high - 2));
    if (score < bestScore) {
      bestScore = score;
      best = type;
    }
  }
  return { type: best, label: VOICE_RANGES[best].label, low: Math.round(low), high: Math.round(high) };
};
