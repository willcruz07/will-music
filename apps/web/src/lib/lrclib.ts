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

export const searchLyrics = async (title: string, artist: string, fetchFn: typeof fetch = fetch): Promise<LrclibResult[]> => {
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  try {
    const response = await fetchFn(`https://lrclib.net/api/search?${params.toString()}`);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as LrclibResult[]) : [];
  } catch {
    return [];
  }
};

export const pickBestLyrics = (results: LrclibResult[], audioDurationSec: number): { result: LrclibResult; warning?: string } | null => {
  const usable = results.filter((r) => r.syncedLyrics || r.plainLyrics);
  if (usable.length === 0) return null;
  const synced = usable.filter((r) => r.syncedLyrics);
  const pool = synced.length ? synced : usable;
  const best = [...pool].sort((a, b) => Math.abs(a.duration - audioDurationSec) - Math.abs(b.duration - audioDurationSec))[0]!;
  return Math.abs(best.duration - audioDurationSec) > 5 ? { result: best, warning: VERSION_WARNING } : { result: best };
};

export const parseLrc = (text: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/u)) {
    const match = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/u.exec(raw.trim());
    if (!match) continue;
    const lyric = match[3]!.trim();
    if (!lyric) continue;
    lines.push({ start: Number(match[1]) * 60 + Number(match[2]), text: lyric });
  }
  return lines;
};

export const distributePlainLyrics = (plain: string, durationSec: number): LyricLine[] => {
  const texts = plain.split(/\r?\n/u).map((l) => l.trim()).filter(Boolean);
  const from = 0.1 * durationSec;
  const span = 0.8 * durationSec;
  return texts.map((text, i) => ({ start: Math.round((from + (span * i) / texts.length) * 100) / 100, text }));
};
