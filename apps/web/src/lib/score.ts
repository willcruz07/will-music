import { BASIC_PITCH, type ChordSegment, type KeyResult, buildGrid, buildMusicXml, chordsToHarmony, estimateTempo, quantize } from '@will-music/engine';
import type { TranscriptionRequest, TranscriptionResponse } from '../worker/transcription.worker.ts';
import { type ScoreRecord, type Song, db, now } from './db.ts';
import { getStems } from './stems.ts';

export type ScoreProgress = { stage: 'decode' | 'models' | 'notes'; done: number; total: number };

export const getScore = (songId: string): Promise<ScoreRecord | undefined> => db.scores.get(songId);
export const saveScore = async (score: ScoreRecord): Promise<void> => {
  await db.scores.put(score);
};

/** A usable tempo: the given one when it is plausible (40–240 BPM), else an estimate from the notes. */
export const safeBpm = (bpm: number | undefined, notes: ScoreRecord['notes']): number =>
  bpm !== undefined && Number.isFinite(bpm) && bpm >= 40 && bpm <= 240 ? Math.round(bpm) : estimateTempo(notes.map((n) => n.start));

/** Builds the lead sheet (melody + chords, optionally guitar tab) from the stored melody. */
export const buildSongScore = (
  song: Pick<Song, 'title' | 'artist'>,
  analysis: { key: KeyResult; chords: ChordSegment[] } | undefined,
  score: ScoreRecord,
  opts: { tab: boolean; bpm?: number },
): string => {
  const bpm = safeBpm(opts.bpm ?? score.bpm, score.notes);
  const chords = analysis?.chords ?? [];
  const grid = buildGrid(bpm, score.notes.map((n) => n.start), chords.filter((c) => c.raw !== 'N' && c.raw !== 'X').map((c) => c.start));
  return buildMusicXml({
    title: song.title,
    artist: song.artist,
    bpm,
    key: analysis?.key,
    notes: quantize(score.notes, grid),
    harmonies: chordsToHarmony(chords, grid),
    tab: opts.tab,
  });
};

const decodeMono = async (blob: Blob, rate: number): Promise<Float32Array> => {
  const context = new OfflineAudioContext(1, 1, rate);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + data[i]! / buffer.numberOfChannels;
  }
  return out;
};

const runWorker = (pcm: Float32Array, onProgress: (p: ScoreProgress) => void): Promise<{ notes: ScoreRecord['notes']; model: string }> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/transcription.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<TranscriptionResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress(msg);
      worker.terminate();
      if (msg.type === 'result') resolve(msg);
      else reject(new Error(msg.message));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'A transcrição das notas falhou.'));
    };
    const request: TranscriptionRequest = { type: 'transcribe', pcm };
    worker.postMessage(request, [pcm.buffer]);
  });

/** Transcribes the melody (from the separated lead vocal when there is one) and stores it. */
export const transcribeMelody = async (song: Song, onProgress: (p: ScoreProgress) => void): Promise<ScoreRecord> => {
  onProgress({ stage: 'decode', done: 0, total: 1 });
  const lead = (await getStems(song.id))?.tracks.find((t) => t.name === 'lead');
  const blob = lead?.blob ?? (await db.audio.get(song.id))?.blob;
  if (!blob) throw new Error('Esta música não tem áudio para transcrever.');
  const pcm = await decodeMono(blob, BASIC_PITCH.SAMPLE_RATE);
  const { notes, model } = await runWorker(pcm, onProgress);
  if (notes.length === 0) throw new Error('Nenhuma nota clara foi encontrada neste áudio.');
  const score: ScoreRecord = {
    songId: song.id,
    notes,
    bpm: safeBpm(song.tempo, notes),
    source: lead ? 'lead' : 'mix',
    model,
    createdAt: now(),
  };
  await saveScore(score);
  return score;
};

export const downloadText = (text: string, fileName: string, type: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
