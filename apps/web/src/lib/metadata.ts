import { parseBlob } from 'music-metadata';
import { guessFromFileName } from './fileName.ts';

export type FileTags = { title: string; artist: string; durationSec: number };

export const readTags = async (file: File): Promise<FileTags> => {
  const guess = guessFromFileName(file.name);
  try {
    const { common, format } = await parseBlob(file);
    return { title: common.title?.trim() || guess.title, artist: common.artist?.trim() || guess.artist, durationSec: format.duration ?? 0 };
  } catch {
    return { ...guess, durationSec: 0 };
  }
};
