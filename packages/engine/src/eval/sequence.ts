import type { ChordSegment } from '../chords/decode.ts';
import { type MajMin, toMajMin } from '../chords/labels.ts';
import type { KeyMode, KeyResult } from '../key/key.ts';

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const pitchClass = (root: string): number => {
  const match = /^([A-G])([#b]?)$/u.exec(root);
  if (!match) throw new RangeError(`Invalid note name: ${root}`);
  const base = NOTE_PC[match[1]!]!;
  const shift = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (base + shift + 12) % 12;
};

/** Brazilian chord notation → root pitch class + major/minor. `N.C.` → null; unparseable → throws. */
export const parseReferenceChord = (text: string): MajMin | null => {
  const trimmed = text.trim();
  if (/^n\.?c\.?$/iu.test(trimmed)) return null;
  const match = /^([A-G])([#b]?)(.*)$/u.exec(trimmed);
  if (!match) throw new RangeError(`Cannot parse chord "${text}"`);
  const rest = (match[3] ?? '').split('/')[0] ?? '';
  const minor = (/^m(?!aj)/u.test(rest)) || rest.includes('°') || rest.includes('º') || rest.includes('dim');
  return { pc: pitchClass(`${match[1]}${match[2]}`), quality: minor ? 'min' : 'maj' };
};

export const simplifySegments = (segments: readonly ChordSegment[], minDuration = 0.75): MajMin[] => {
  const out: MajMin[] = [];
  for (const segment of segments) {
    if (segment.end - segment.start < minDuration) continue;
    const chord = toMajMin(segment.raw);
    if (!chord) continue;
    const last = out[out.length - 1];
    if (last && last.pc === chord.pc && last.quality === chord.quality) continue;
    out.push(chord);
  }
  return out;
};

const same = (a: MajMin, b: MajMin): boolean => a.pc === b.pc && a.quality === b.quality;

export const lcsScore = (
  reference: readonly MajMin[],
  predicted: readonly MajMin[],
): { lcs: number; recall: number; precision: number } => {
  const n = reference.length;
  const m = predicted.length;
  if (n === 0 || m === 0) return { lcs: 0, recall: 0, precision: 0 };
  let prev = new Uint32Array(m + 1);
  let curr = new Uint32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      curr[j] = same(reference[i - 1]!, predicted[j - 1]!) ? prev[j - 1]! + 1 : Math.max(prev[j]!, curr[j - 1]!);
    }
    [prev, curr] = [curr, prev];
  }
  const lcs = prev[m]!;
  return { lcs, recall: lcs / n, precision: lcs / m };
};

export type KeyMatch = 'exact' | 'relative' | 'fifth' | 'wrong';

export const compareKeys = (reference: { root: string; mode: KeyMode }, predicted: KeyResult): KeyMatch => {
  const r = pitchClass(reference.root);
  const p = pitchClass(predicted.root);
  if (reference.mode === predicted.mode) {
    if (r === p) return 'exact';
    if ((r + 7) % 12 === p || (p + 7) % 12 === r) return 'fifth';
    return 'wrong';
  }
  const majorPc = reference.mode === 'major' ? r : p;
  const minorPc = reference.mode === 'major' ? p : r;
  return (majorPc + 9) % 12 === minorPc ? 'relative' : 'wrong';
};
