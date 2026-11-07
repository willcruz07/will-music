import { computePeaks } from '@will-music/engine';
import { db } from './db.ts';

const RATE = 8000;
export const PEAK_COLUMNS = 1200;

/** Waveform of a song, computed once (decoded at 8 kHz mono, which is plenty for a drawing) and cached. */
export const getPeaks = async (songId: string): Promise<{ peaks: Float32Array; duration: number } | null> => {
  const cached = await db.peaks.get(songId);
  if (cached) return cached;
  const audio = await db.audio.get(songId);
  if (!audio) return null;
  const context = new OfflineAudioContext(1, 1, RATE);
  const buffer = await context.decodeAudioData(await audio.blob.arrayBuffer());
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < mono.length; i++) mono[i] = mono[i]! + data[i]! / buffer.numberOfChannels;
  }
  const record = { songId, peaks: computePeaks(mono, PEAK_COLUMNS), duration: buffer.duration };
  await db.peaks.put(record).catch(() => undefined); // a cache: losing it only costs a recompute
  return record;
};
