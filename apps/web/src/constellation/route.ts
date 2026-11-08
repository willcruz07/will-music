import { type Center, type Chord, type Move, type MoveKind, chordKey, neighbors } from './harmony.ts';

/** How "musical" each kind of step is: cadences and ii–V chains first, colorful substitutions next. */
const COST: Partial<Record<MoveKind, number>> = { cadencia: 1, iiV: 1, cadeia: 1, secundario: 1.5, subV: 1.5, tritono: 1.5, relativo: 1.5 };
const DEFAULT_COST = 2;
const REVISIT = 3;
/** Arriving at the target without resolving a dominant sounds flat: prefer a path that ends in a cadence. */
const SOFT_ARRIVAL = 2;

type Entry = { cost: number; chord: Chord; center: Center; path: Move[] };
const stateKey = (chord: Chord, center: Center) => `${chordKey(chord)}@${center.root}${center.minor ? 'm' : ''}`;

/**
 * A path from `from` to `target` through real neighbors, preferring tension and resolution (cheapest
 * total cost). `[]` when already there, `null` when the target is out of reach in `maxSteps`.
 */
export const suggestRoute = (from: Chord, center: Center, target: Chord, maxSteps = 8): Move[] | null => {
  const goal = chordKey(target);
  if (chordKey(from) === goal) return [];
  const queue: Entry[] = [{ cost: 0, chord: from, center, path: [] }];
  const done = new Set<string>();
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { cost, chord, center: at, path } = queue.shift()!;
    if (chordKey(chord) === goal) return path;
    const key = stateKey(chord, at);
    if (done.has(key) || path.length >= maxSteps) continue;
    done.add(key);
    const used = new Set([chordKey(from), ...path.map((m) => chordKey(m.to))]);
    for (const move of neighbors(chord, at)) {
      if (done.has(stateKey(move.to, move.nextCenter))) continue;
      const arrives = chordKey(move.to) === goal;
      const step = (COST[move.kind] ?? DEFAULT_COST) + (used.has(chordKey(move.to)) ? REVISIT : 0) + (arrives && move.kind !== 'cadencia' ? SOFT_ARRIVAL : 0);
      queue.push({ cost: cost + step, chord: move.to, center: move.nextCenter, path: [...path, move] });
    }
  }
  return null;
};
