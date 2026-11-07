import {
  BASIC_PITCH,
  type ChordSegment,
  type KeyResult,
  type NoteEvent,
  buildDrumXml,
  buildGrid,
  buildMusicXml,
  buildPianoXml,
  chordsToHarmony,
  detectDrumHits,
  estimateTempo,
  quantize,
  tickAt,
} from '@will-music/engine';
import type { TranscriptionRequest, TranscriptionResponse } from '../worker/transcription.worker.ts';
import { type ScoreRecord, type Song, db, now } from './db.ts';
import { getStems } from './stems.ts';

export type ScoreProgress = { stage: 'decode' | 'models' | 'notes'; done: number; total: number };

/** The kinds of score the app writes. */
export type ScoreType = 'melody' | 'guitar' | 'keys' | 'drums';
export const SCORE_TYPES: { type: ScoreType; label: string; hint: string }[] = [
  { type: 'melody', label: 'Melodia', hint: 'A linha da voz com a cifra por cima.' },
  { type: 'guitar', label: 'Guitarra', hint: 'A melodia em pauta e tablatura, com as casas de cada nota.' },
  { type: 'keys', label: 'Teclado', hint: 'Clave de sol e clave de fá, com a armadura do tom.' },
  { type: 'drums', label: 'Bateria', hint: 'Bumbo, caixa e chimbal. Precisa da faixa de bateria separada.' },
];

export const getScore = (songId: string): Promise<ScoreRecord | undefined> => db.scores.get(songId);
export const saveScore = async (score: ScoreRecord): Promise<void> => {
  await db.scores.put(score);
};

/** A usable tempo: the given one when it is plausible (40–240 BPM), else an estimate from the onsets. */
export const safeBpm = (bpm: number | undefined, notes: readonly { start: number }[]): number =>
  bpm !== undefined && Number.isFinite(bpm) && bpm >= 40 && bpm <= 240 ? Math.round(bpm) : estimateTempo(notes.map((n) => n.start));

type AnalysisLike = { key: KeyResult; chords: ChordSegment[] } | undefined;

const usableChords = (analysis: AnalysisLike) => (analysis?.chords ?? []).filter((c) => c.raw !== 'N' && c.raw !== 'X');

/** Builds the lead sheet (melody + chords, optionally guitar tab) from the stored melody. */
export const buildSongScore = (song: Pick<Song, 'title' | 'artist'>, analysis: AnalysisLike, score: ScoreRecord, opts: { tab: boolean; bpm?: number }): string => {
  const bpm = safeBpm(opts.bpm ?? score.bpm, score.notes);
  const chords = analysis?.chords ?? [];
  const grid = buildGrid(bpm, score.notes.map((n) => n.start), usableChords(analysis).map((c) => c.start));
  return buildMusicXml({ title: song.title, artist: song.artist, bpm, key: analysis?.key, notes: quantize(score.notes, grid), harmonies: chordsToHarmony(chords, grid), tab: opts.tab });
};

/** Whether the stored score already has what a type needs. */
export const hasScoreType = (score: ScoreRecord | undefined, type: ScoreType): boolean =>
  !!score && (type === 'keys' ? !!score.piano?.notes.length : type === 'drums' ? !!score.drums?.hits.length : score.notes.length > 0);

/** MusicXML for one score type, or null when that part has not been transcribed yet. */
export const buildScoreXml = (type: ScoreType, song: Pick<Song, 'title' | 'artist'>, analysis: AnalysisLike, score: ScoreRecord | undefined): string | null => {
  if (!score || !hasScoreType(score, type)) return null;
  if (type === 'melody' || type === 'guitar') return buildSongScore(song, analysis, score, { tab: type === 'guitar' });
  const chords = usableChords(analysis);
  if (type === 'keys') {
    const notes = score.piano!.notes;
    const bpm = safeBpm(score.bpm, notes);
    const grid = buildGrid(bpm, notes.map((n) => n.start), chords.map((c) => c.start));
    return buildPianoXml({ title: song.title, artist: song.artist, bpm, key: analysis?.key, notes: quantizePoly(notes, grid), harmonies: chordsToHarmony(analysis?.chords ?? [], grid) });
  }
  const hits = score.drums!.hits;
  const bpm = safeBpm(score.bpm, hits.map((h) => ({ start: h.time })));
  const grid = buildGrid(bpm, hits.map((h) => h.time), chords.map((c) => c.start));
  return buildDrumXml({ title: song.title, artist: song.artist, bpm, hits: hits.map((h) => ({ tick: tickAt(grid, h.time), kind: h.kind })) });
};

/** Polyphonic quantization: every note keeps its own start and length on the grid (no monophonic cut). */
const quantizePoly = (notes: readonly NoteEvent[], grid: ReturnType<typeof buildGrid>) =>
  notes.map((n) => {
    const start = tickAt(grid, n.start);
    return { pitch: n.pitch, start, dur: Math.max(1, tickAt(grid, n.end) - start) };
  });

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

const runWorker = (pcm: Float32Array, poly: boolean, onProgress: (p: ScoreProgress) => void): Promise<{ notes: NoteEvent[]; model: string }> =>
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
    const request: TranscriptionRequest = { type: 'transcribe', pcm, poly };
    worker.postMessage(request, [pcm.buffer]);
  });

/** Merges a newly transcribed part into the stored score, keeping the other parts. */
const store = async (song: Song, patch: Partial<ScoreRecord>, onsets: readonly { start: number }[]): Promise<ScoreRecord> => {
  const existing = await getScore(song.id);
  const score: ScoreRecord = {
    songId: song.id,
    notes: [],
    bpm: existing?.bpm ?? safeBpm(song.tempo, onsets),
    source: 'mix',
    model: '',
    createdAt: now(),
    ...existing,
    ...patch,
  };
  await saveScore(score);
  return score;
};

/** Transcribes the melody (from the separated lead vocal when there is one) and stores it. */
export const transcribeMelody = async (song: Song, onProgress: (p: ScoreProgress) => void): Promise<ScoreRecord> => {
  onProgress({ stage: 'decode', done: 0, total: 1 });
  const tracks = (await getStems(song.id))?.tracks ?? [];
  const lead = tracks.find((t) => t.name === 'lead') ?? tracks.find((t) => t.name === 'vocals');
  const blob = lead?.blob ?? (await db.audio.get(song.id))?.blob;
  if (!blob) throw new Error('Esta música não tem áudio para transcrever.');
  const { notes, model } = await runWorker(await decodeMono(blob, BASIC_PITCH.SAMPLE_RATE), false, onProgress);
  if (notes.length === 0) throw new Error('Nenhuma nota clara foi encontrada neste áudio.');
  return store(song, { notes, source: lead ? 'lead' : 'mix', model, createdAt: now() }, notes);
};

/** Keyboard part: every note of the piano track (or the accompaniment, or the whole song). */
export const transcribeKeys = async (song: Song, onProgress: (p: ScoreProgress) => void): Promise<ScoreRecord> => {
  onProgress({ stage: 'decode', done: 0, total: 1 });
  const tracks = (await getStems(song.id))?.tracks ?? [];
  const pick = ['piano', 'other', 'instrumental'].map((n) => tracks.find((t) => t.name === n)).find(Boolean);
  const blob = pick?.blob ?? (await db.audio.get(song.id))?.blob;
  if (!blob) throw new Error('Esta música não tem áudio para transcrever.');
  const { notes } = await runWorker(await decodeMono(blob, BASIC_PITCH.SAMPLE_RATE), true, onProgress);
  // Very low and very high notes are mostly bass and cymbal leakage on a piano part.
  const keys = notes.filter((n) => n.pitch >= 33 && n.pitch <= 96);
  if (keys.length === 0) throw new Error('Nenhuma nota clara de teclado foi encontrada.');
  return store(song, { piano: { notes: keys, source: pick?.name ?? 'mix' } }, keys);
};

export const DRUMS_NEED_STEMS = 'A partitura de bateria precisa da faixa de bateria: abra os controles do player e separe em 4, 6 faixas ou na completa.';

/** Drum part from the separated drum track. */
export const transcribeDrums = async (song: Song, onProgress: (p: ScoreProgress) => void): Promise<ScoreRecord> => {
  onProgress({ stage: 'decode', done: 0, total: 1 });
  const sets = await db.stemSets.where('songId').equals(song.id).toArray();
  const drums = sets.flatMap((s) => s.tracks).find((t) => t.name === 'drums');
  if (!drums) throw new Error(DRUMS_NEED_STEMS);
  const rate = 22050;
  const pcm = await decodeMono(drums.blob, rate);
  onProgress({ stage: 'notes', done: 0, total: 1 });
  const hits = detectDrumHits(pcm, rate);
  if (hits.length === 0) throw new Error('Nenhuma batida clara foi encontrada na faixa de bateria.');
  return store(song, { drums: { hits } }, hits.map((h) => ({ start: h.time })));
};

export const TRANSCRIBE: Record<ScoreType, (song: Song, onProgress: (p: ScoreProgress) => void) => Promise<ScoreRecord>> = {
  melody: transcribeMelody,
  guitar: transcribeMelody,
  keys: transcribeKeys,
  drums: transcribeDrums,
};

export const downloadText = (text: string, fileName: string, type: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
