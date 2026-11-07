import type { GuitarShape } from './chordShapes.ts';

/** Fretted instruments whose shapes are computed (no chord book needed); strings from the lowest, as MIDI. */
export const CAVAQUINHO = { name: 'Cavaquinho', tuning: [62, 67, 71, 74] } as const;

/**
 * Finds playable shapes for a chord on a fretted instrument: every string sounds a chord note, every
 * chord note sounds (the fifth may be left out when there are more notes than strings), within a
 * four-fret hand position. Shapes with the root in the bass and lower on the neck come first.
 */
export const findVoicings = (pcs: readonly number[], rootPc: number, tuning: readonly number[], { maxFret = 12, max = 6 } = {}): GuitarShape[] => {
  const strings = tuning.length;
  const unique = [...new Set(pcs.map((p) => ((p % 12) + 12) % 12))];
  const needed = unique.length > strings ? unique.filter((pc) => pc !== (rootPc + 7) % 12) : unique;
  const required = needed.slice(0, strings);
  const allowed = new Set(unique);
  const found = new Map<string, { shape: GuitarShape; score: number }>();
  for (let base = 1; base <= maxFret; base++) {
    const options = tuning.map((open) => [0, base, base + 1, base + 2, base + 3].filter((f, i, a) => f <= maxFret && a.indexOf(f) === i && allowed.has((open + f) % 12)));
    if (options.some((o) => !o.length)) continue;
    const walk = (i: number, acc: number[]) => {
      if (i === strings) {
        const notes = acc.map((f, s) => (tuning[s]! + f) % 12);
        if (!required.every((pc) => notes.includes(pc))) return;
        const fretted = acc.filter((f) => f > 0);
        const lo = fretted.length ? Math.min(...fretted) : 0;
        const hi = fretted.length ? Math.max(...fretted) : 0;
        if (hi - lo > 3) return;
        const key = acc.join(',');
        const score = hi + (hi - lo) + (notes[0] === rootPc ? 0 : 4);
        if (!found.has(key) || found.get(key)!.score > score) {
          // High on the neck the diagram starts at the first fretted fret, and frets are counted from it.
          const baseFret = hi > 4 ? lo : 1;
          const frets = baseFret > 1 ? acc.map((f) => (f > 0 ? f - baseFret + 1 : 0)) : [...acc];
          found.set(key, { shape: { frets, fingers: acc.map(() => 0), baseFret, barres: [] }, score });
        }
        return;
      }
      for (const f of options[i]!) walk(i + 1, [...acc, f]);
    };
    walk(0, []);
  }
  return [...found.values()]
    .sort((a, z) => a.score - z.score)
    .slice(0, max)
    .map((x) => x.shape);
};
