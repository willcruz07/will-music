import { CHORD_ROOTS, NO_CHORD, UNKNOWN_CHORD } from './vocab.ts';

export type MajMin = { pc: number; quality: 'maj' | 'min' };

const DISPLAY_SUFFIX: Record<string, string> = {
  maj: '', min: 'm', dim: '°', aug: '+', min6: 'm6', maj6: '6', min7: 'm7', minmaj7: 'm(7M)',
  maj7: '7M', '7': '7', dim7: '°7', hdim7: 'm7(b5)', sus2: 'sus2', sus4: 'sus4',
};

const MINOR_QUALITIES = new Set(['min', 'min6', 'min7', 'minmaj7', 'dim', 'dim7', 'hdim7']);

const split = (raw: string): { root: string; quality: string } => {
  const colon = raw.indexOf(':');
  return colon < 0 ? { root: raw, quality: 'maj' } : { root: raw.slice(0, colon), quality: raw.slice(colon + 1) };
};

export const toDisplayLabel = (raw: string): string => {
  if (raw === NO_CHORD) return 'N.C.';
  if (raw === UNKNOWN_CHORD) return '?';
  const { root, quality } = split(raw);
  return `${root}${DISPLAY_SUFFIX[quality] ?? quality}`;
};

export const toMajMin = (raw: string): MajMin | null => {
  if (raw === NO_CHORD || raw === UNKNOWN_CHORD) return null;
  const { root, quality } = split(raw);
  const pc = (CHORD_ROOTS as readonly string[]).indexOf(root);
  if (pc < 0) return null;
  return { pc, quality: MINOR_QUALITIES.has(quality) ? 'min' : 'maj' };
};
