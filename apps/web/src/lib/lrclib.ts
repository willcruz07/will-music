import type { LyricLine } from './db.ts';

export type LrclibResult = {
  id: number;
  trackName: string;
  artistName: string;
  duration: number;
  syncedLyrics: string | null;
  plainLyrics: string | null;
};

export const VERSION_WARNING = 'A letra encontrada pode ser de outra versão da música.';

const query = async (params: URLSearchParams, fetchFn: typeof fetch): Promise<LrclibResult[]> => {
  try {
    const response = await fetchFn(`https://lrclib.net/api/search?${params.toString()}`);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as LrclibResult[]) : [];
  } catch {
    return [];
  }
};

/** Exact title + artist search first; if it finds nothing, a free-text search with both. */
export const searchLyrics = async (title: string, artist: string, fetchFn: typeof fetch = fetch): Promise<LrclibResult[]> => {
  const exact = await query(new URLSearchParams({ track_name: title, artist_name: artist }), fetchFn);
  if (exact.length) return exact;
  return query(new URLSearchParams({ q: `${title} ${artist}`.trim() }), fetchFn);
};

const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export const sameArtist = (a: string, b: string): boolean => {
  const x = fold(a);
  const y = fold(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

/** Auto-pick only lyrics from the same artist when one is known; other results stay available for a manual choice. */
export const pickBestLyrics = (
  results: LrclibResult[],
  audioDurationSec: number,
  artist = '',
): { result: LrclibResult; warning?: string } | null => {
  const usable = results.filter((r) => (r.syncedLyrics || r.plainLyrics) && (!artist || sameArtist(r.artistName, artist)));
  if (usable.length === 0) return null;
  const synced = usable.filter((r) => r.syncedLyrics);
  const pool = synced.length ? synced : usable;
  const best = [...pool].sort((a, b) => Math.abs(a.duration - audioDurationSec) - Math.abs(b.duration - audioDurationSec))[0]!;
  return Math.abs(best.duration - audioDurationSec) > 5 ? { result: best, warning: VERSION_WARNING } : { result: best };
};

export const parseLrc = (text: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/u)) {
    const match = /^((?:\[\d+:\d+(?:\.\d+)?\])+)\s*(.*)$/u.exec(raw.trim());
    if (!match) continue;
    const lyric = match[2]!.trim();
    if (!lyric) continue;
    for (const stamp of match[1]!.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/gu)) {
      lines.push({ start: Number(stamp[1]) * 60 + Number(stamp[2]), text: lyric });
    }
  }
  return lines.sort((a, b) => a.start - b.start);
};

/**
 * Lyrics from LRCLIB for an analysis, without any model: synced lines when available, plain lyrics spread over the
 * song otherwise. Null when nothing from the same artist was found (or offline).
 */
export const findSongLyrics = async (
  title: string,
  artist: string,
  durationSec: number,
  fetchFn: typeof fetch = fetch,
): Promise<{ source: 'lrclib'; lrclibId: number; lines: LyricLine[]; warning?: string } | null> => {
  if (!title.trim() || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  const picked = pickBestLyrics(await searchLyrics(title.trim(), artist.trim(), fetchFn), durationSec, artist.trim());
  if (!picked) return null;
  const { result } = picked;
  const synced = result.syncedLyrics ? parseLrc(result.syncedLyrics) : [];
  const lines = synced.length ? synced : distributePlainLyrics(result.plainLyrics ?? '', durationSec);
  if (!lines.length) return null;
  const warning = picked.warning ?? (synced.length ? undefined : 'A letra veio sem tempos; as linhas foram distribuídas ao longo da música.');
  return { source: 'lrclib', lrclibId: result.id, lines, ...(warning ? { warning } : {}) };
};

export const distributePlainLyrics =(plain: string, durationSec: number): LyricLine[] => {
  const texts = plain.split(/\r?\n/u).map((l) => l.trim()).filter(Boolean);
  const from = 0.1 * durationSec;
  const span = 0.8 * durationSec;
  return texts.map((text, i) => ({ start: Math.round((from + (span * i) / texts.length) * 100) / 100, text }));
};
