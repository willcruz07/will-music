import { type Center, type Chord, type Motion, type Move, chordKey, neighbors, startCenter } from './harmony.ts';

/**
 * The state of a constellation: the stars opened so far, the links between them, the trail walked, the
 * star in focus and the current tonal center. Pure functions: each one returns a new Web.
 * Stars are identified by pitch (`chordKey`), so a chord reached by two paths is one star, and a star
 * never moves once placed.
 */

/** `resolvesTo`: where a substitute dominant was aimed when it was reached (Db7 as the subV of C). */
export type StarNode = { key: string; chord: Chord; center: Center; x: number; y: number; resolvesTo?: Chord };
export type Link = { from: string; to: string; move: Move };
export type Visit = { key: string; chord: Chord; center: Center; resolvesTo?: Chord };
/**
 * `steps[i]`: the move that reached `trail[i]` (null for the starting chord and for a jump back to an opened star).
 * Kept per step, not per star: a star visited twice keeps the color of each visit, and the start never changes.
 */
export type Web = { nodes: Record<string, StarNode>; links: Link[]; trail: string[]; steps: (Move | null)[]; visits: Visit[]; origin: Visit; focus: string; center: Center; opened: boolean };
export type PreviewStar = { key: string; chord: Chord; center: Center; x: number; y: number; from: string; move: Move };

const ORBIT_RADIUS = 220;
const PREVIEW_RADIUS = 120;
const MIN_GAP = 90;
const STEP = Math.PI / 6;
const SECTOR = (Math.PI * 2) / 3;

export const startWeb = (chord: Chord): Web => {
  const key = chordKey(chord);
  const center = startCenter(chord);
  const origin = { key, chord: { ...chord }, center: { ...center } };
  return { nodes: { [key]: { key, chord: { ...chord }, center, x: 0, y: 0 } }, links: [], trail: [key], steps: [null], visits: [origin], origin, focus: key, center, opened: false };
};

const far = (nodes: Iterable<{ x: number; y: number }>, x: number, y: number) => [...nodes].every((n) => Math.hypot(n.x - x, n.y - y) > MIN_GAP);

/** First free spot around `origin`, starting at angle `from` and alternating sides; grows the radius when crowded. */
const freeSpot = (taken: { x: number; y: number }[], origin: { x: number; y: number }, from: number) => {
  for (let radius = ORBIT_RADIUS; ; radius += 80) {
    for (let i = 0; i < 12; i++) {
      const a = from + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * STEP;
      const x = Math.round(origin.x + radius * Math.cos(a));
      const y = Math.round(origin.y + radius * Math.sin(a));
      if (far(taken, x, y)) return { x, y };
    }
  }
};

/** Opens the orbit of the star in focus: places the neighbors that are new and links them. */
export const openFocus = (web: Web): Web => {
  const focus = web.nodes[web.focus]!;
  const nodes = { ...web.nodes, [focus.key]: { ...focus, center: web.center } };
  const links = web.links.filter((l) => l.from !== focus.key);
  // Grow away from where we came from (the heading), with one sector per motion: resolve ahead, tension to one side, relax to the other.
  const prev = web.trail.length > 1 ? nodes[web.trail[web.trail.length - 2]!] : undefined;
  const heading = prev && (prev.x !== focus.x || prev.y !== focus.y) ? Math.atan2(focus.y - prev.y, focus.x - prev.x) : -Math.PI / 2;
  const next: Record<Motion, number> = { resolve: heading, tensiona: heading + SECTOR, relaxa: heading - SECTOR };
  for (const move of neighbors(focus.chord, web.center, focus.resolvesTo)) {
    const key = chordKey(move.to);
    if (!nodes[key]) {
      const spot = freeSpot(Object.values(nodes), focus, next[move.motion]);
      nodes[key] = { key, chord: move.to, center: move.nextCenter, ...spot, ...(move.resolvesTo ? { resolvesTo: move.resolvesTo } : {}) };
      // The next star of the same motion goes beside this one, away from the other sectors.
      const side = move.motion === 'relaxa' ? -1 : 1;
      next[move.motion] = Math.atan2(spot.y - focus.y, spot.x - focus.x) + side * STEP * 0.75;
    }
    links.push({ from: focus.key, to: key, move });
  }
  return { ...web, nodes, links, opened: true };
};

/** The links out of the star in focus: the neighbors one can walk to. */
export const orbit = (web: Web): Link[] => (web.opened ? web.links.filter((l) => l.from === web.focus) : []);

/** One ring beyond the orbit (not walkable): the neighbors of each neighbor, placed fanning outwards. */
export const previewStars = (web: Web): PreviewStar[] => {
  const focus = web.nodes[web.focus]!;
  const stars: PreviewStar[] = [];
  // A chord several neighbors lead to is one bubble: every link to it reuses the first placement.
  const placed = new Map<string, { x: number; y: number }>();
  for (const link of orbit(web)) {
    const from = web.nodes[link.to]!;
    const out = Math.atan2(from.y - focus.y, from.x - focus.x);
    const next = neighbors(link.move.to, link.move.nextCenter, link.move.resolvesTo).filter((m) => chordKey(m.to) !== focus.key || m.motion === 'resolve').slice(0, 4);
    next.forEach((m, i) => {
      const key = chordKey(m.to);
      const a = out + (i - (next.length - 1) / 2) * (Math.PI / 2 / Math.max(1, next.length - 1));
      const spot = web.nodes[key] ?? placed.get(key) ?? { x: Math.round(from.x + PREVIEW_RADIUS * Math.cos(a)), y: Math.round(from.y + PREVIEW_RADIUS * Math.sin(a)) };
      placed.set(key, { x: spot.x, y: spot.y });
      stars.push({ key, chord: m.to, center: m.nextCenter, from: link.to, move: m, x: spot.x, y: spot.y });
    });
  }
  return stars;
};

export const walk = (web: Web, move: Move): Web => {
  const key = chordKey(move.to);
  const at = web.nodes[key] ?? { key, ...freeSpot(Object.values(web.nodes), web.nodes[web.focus]!, 0) };
  // The type the student chose (G7(b9) instead of G7) is what the star now holds.
  const { resolvesTo: _old, ...rest } = at as StarNode;
  const nodes = { ...web.nodes, [key]: { ...rest, key, chord: move.to, center: move.nextCenter, ...(move.resolvesTo ? { resolvesTo: move.resolvesTo } : {}) } };
  const visit: Visit = { key, chord: { ...move.to }, center: { ...move.nextCenter }, ...(move.resolvesTo ? { resolvesTo: { ...move.resolvesTo } } : {}) };
  return openFocus({ ...web, nodes, trail: [...web.trail, key], steps: [...web.steps, move], visits: [...web.visits, visit], focus: key, center: move.nextCenter });
};

/** Brings an opened star back to focus; the path continues from there (the trail is cut back if it was on it). */
export const focusOn = (web: Web, key: string, visitIndex?: number): Web => {
  const node = web.nodes[key];
  if (!node) return web;
  const at = visitIndex !== undefined && web.visits[visitIndex]?.key === key ? visitIndex : web.trail.lastIndexOf(key);
  const trail = at >= 0 ? web.trail.slice(0, at + 1) : [...web.trail, key];
  const steps = at >= 0 ? web.steps.slice(0, at + 1) : [...web.steps, null];
  const visit: Visit = at >= 0 ? web.visits[at]! : { key, chord: { ...node.chord }, center: { ...node.center }, ...(node.resolvesTo ? { resolvesTo: { ...node.resolvesTo } } : {}) };
  const visits = at >= 0 ? web.visits.slice(0, at + 1) : [...web.visits, visit];
  const { resolvesTo: _old, ...rest } = node;
  const nodes = { ...web.nodes, [key]: { ...rest, ...visit } };
  return openFocus({ ...web, nodes, trail, steps, visits, focus: key, center: visit.center });
};

/** The move that last reached a star on the trail (its first visit wins for the starting chord: it stays the start). */
export const arrivalOf = (web: Web, key: string): Move | null | undefined => {
  const first = web.trail.indexOf(key);
  if (first < 0) return undefined;
  return first === 0 ? null : web.steps[web.trail.lastIndexOf(key)] ?? null;
};

export const resetWeb = (web: Web): Web => openFocus(startWeb(web.origin.chord));

/** An explicit exploration choice, never inferred from a single local resolution. */
export const adoptCenter = (web: Web, center: Center): Web => {
  const visit = { ...web.visits.at(-1)!, center: { ...center } };
  return openFocus({ ...web, center: visit.center, visits: [...web.visits.slice(0, -1), visit] });
};
