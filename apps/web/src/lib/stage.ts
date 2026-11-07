const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export type StageAction = 'next' | 'prev' | 'scroll-down' | 'scroll-up';

/** Keyboard and Bluetooth page-turner pedals (they send arrows, PageUp/PageDown or space). */
export const stageAction = (e: { key: string; code: string; targetTag?: string }): StageAction | null => {
  if (e.targetTag && FIELD_TAGS.has(e.targetTag)) return null;
  switch (e.key) {
    case 'ArrowRight':
    case 'PageDown':
      return 'next';
    case 'ArrowLeft':
    case 'PageUp':
      return 'prev';
    case 'ArrowDown':
      return 'scroll-down';
    case 'ArrowUp':
      return 'scroll-up';
    default:
      return e.code === 'Space' ? 'scroll-down' : null;
  }
};

const rootPc = (key: string): number | null => {
  const m = /^([A-G][#b]?)/u.exec(key.trim());
  return m ? (PC[m[1]!] ?? null) : null;
};

/** Smallest transposition (−5…+6 semitones) that takes one key to another. */
export const semitonesTo = (fromKey: string, toKey: string): number => {
  const a = rootPc(fromKey);
  const b = rootPc(toKey);
  if (a === null || b === null) return 0;
  const d = (b - a + 12) % 12;
  return d > 6 ? d - 12 : d;
};
