import { parseBlob } from 'music-metadata';

export type FileTags = { title: string; artist: string; durationSec: number };

const baseName = (name: string): string => name.replace(/\.[^.]+$/u, '');

export const readTags = async (file: File): Promise<FileTags> => {
  try {
    const { common, format } = await parseBlob(file);
    return { title: common.title?.trim() || baseName(file.name), artist: common.artist?.trim() ?? '', durationSec: format.duration ?? 0 };
  } catch {
    return { title: baseName(file.name), artist: '', durationSec: 0 };
  }
};
