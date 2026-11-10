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
  const [structure = 'maj', bass] = quality.split('/');
  const match = /^([^()]+)(.*)$/u.exec(structure);
  const basic = match?.[1] ?? structure;
  const decorations = match?.[2] ?? '';
  const extended: Record<string, string> = { '9': '7(9)', '11': '7(9,11)', '13': '7(9,11,13)', min9: 'm7(9)', min11: 'm7(9,11)', min13: 'm7(9,11,13)', maj9: '7M(9)', maj13: '7M(9,11,13)' };
  let label = `${root}${DISPLAY_SUFFIX[basic] ?? extended[basic] ?? basic}${decorations}`;
  if (bass) {
    const degree = /^(b*|#*)(\d+)$/u.exec(bass);
    const rootMatch = /^([A-G])([#b]?)$/u.exec(root);
    if (degree && rootMatch) {
      const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      const intervals = [0, 2, 4, 5, 7, 9, 11];
      const alteration = [...degree[1]!].reduce((sum, accidental) => sum + (accidental === '#' ? 1 : -1), 0);
      const pc = (natural[rootMatch[1]!]! + (rootMatch[2] === '#' ? 1 : rootMatch[2] === 'b' ? -1 : 0) + intervals[(Number(degree[2]) - 1) % 7]! + alteration + 24) % 12;
      label += `/${CHORD_ROOTS[pc]}`;
    }
  }
  return label;
};

export const toMajMin = (raw: string): MajMin | null => {
  if (raw === NO_CHORD || raw === UNKNOWN_CHORD) return null;
  const { root, quality } = split(raw);
  const pc = (CHORD_ROOTS as readonly string[]).indexOf(root);
  if (pc < 0) return null;
  return { pc, quality: MINOR_QUALITIES.has(quality) ? 'min' : 'maj' };
};
