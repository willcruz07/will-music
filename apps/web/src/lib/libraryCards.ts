import type { Chart, Song } from './db.ts';
import { parseChordPro } from './chart.ts';
import { transposeKey } from './transpose.ts';

export const durationLabel = (seconds: number): string | undefined => Number.isFinite(seconds) && seconds > 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : undefined;

export const chartCardInfo = (song: Song, chart?: Chart) => {
  const parsed = chart ? parseChordPro(chart.chordPro) : undefined;
  const key = song.key ?? parsed?.meta.key;
  const preview = parsed?.lines.filter(line => line.kind === 'lyric').map(line => line.kind === 'lyric' ? line.parts.map(p => p.text).join('') : '').join(' ').replace(/\s+/gu, ' ').trim();
  return { key: key ? transposeKey(key, chart?.transpose ?? 0) : undefined,
    preview: preview || 'Letra e acordes para ler, editar e imprimir.',
    transpose: chart?.transpose ?? 0,
  };
};
