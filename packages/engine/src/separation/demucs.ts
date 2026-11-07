// HTDemucs 6s (Meta, MIT) exported with the STFT baked in: mix [1,2,343980] → stems [1,6,2,343980].
export const DEMUCS = {
  SAMPLE_RATE: 44100,
  SEGMENT: 343980,
  OVERLAP: 0.25,
  INPUT: 'mix',
  OUTPUT: 'stems',
  SOURCES: ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano'] as const,
} as const;

export type StemMode = 'vocals' | 'four' | 'six' | 'full';

/** Tracks each separation type stores, in display order. */
export const STEM_MODES: Record<StemMode, { tracks: readonly string[] }> = {
  vocals: { tracks: ['instrumental', 'lead', 'backing'] },
  four: { tracks: ['vocals', 'drums', 'bass', 'other'] },
  six: { tracks: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'] },
  full: { tracks: ['lead', 'backing', 'drums', 'bass', 'guitar', 'piano', 'other'] },
};

/** Tracks a mode takes from the Demucs output (the "full" mode gets its voices from kara2). */
const FROM_DEMUCS: Record<Exclude<StemMode, 'vocals'>, readonly (string | readonly string[])[]> = {
  four: ['vocals', 'drums', 'bass', ['other', 'guitar', 'piano']],
  six: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'],
  full: ['drums', 'bass', 'guitar', 'piano', 'other'],
};

export const demucsTrackNames = (mode: Exclude<StemMode, 'vocals'>): string[] =>
  FROM_DEMUCS[mode].map((t) => (typeof t === 'string' ? t : t[0]!));

/** Planar stereo tracks [2 × segment] for a mode from one model output [6 × 2 × segment]. */
export const demucsTracks = (mode: Exclude<StemMode, 'vocals'>, output: Float32Array, segment: number): Float32Array[] => {
  const source = (name: string) => {
    const k = DEMUCS.SOURCES.indexOf(name as (typeof DEMUCS.SOURCES)[number]);
    return output.subarray(k * 2 * segment, (k + 1) * 2 * segment);
  };
  return FROM_DEMUCS[mode].map((t) => {
    if (typeof t === 'string') return source(t);
    const sum = new Float32Array(2 * segment);
    for (const name of t) {
      const s = source(name);
      for (let i = 0; i < sum.length; i++) sum[i] = sum[i]! + s[i]!;
    }
    return sum;
  });
};
