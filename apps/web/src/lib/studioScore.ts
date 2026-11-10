import { BASIC_PITCH, detectDrumHits, splitVoices, toMelody, type Grid, type NoteEvent } from '@will-music/engine';
import { db, now, type Song, type ScoreRecord, type StemsRecord } from './db.ts';
import { decodeMono, runWorker, safeBpm, SCORE_TYPES, type ScoreProgress, type ScoreType } from './score.ts';

export type StudioScore = ScoreRecord & { vocalNotes?: NoteEvent[] };
type Deps = { decode?: typeof decodeMono; run?: typeof runWorker };
const abortIfNeeded = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError'); };
export const studioScoreReady = (score: StudioScore | undefined, type: ScoreType): boolean =>
  !!score && (type === 'guitar' ? !!score.guitar?.notes.length : type === 'melody' ? !!score.notes.length : type === 'keys' ? !!score.piano?.notes.length : type === 'drums' ? !!score.drums?.hits.length : !!score.choir);

/** Inputs are supplied by the session. No IndexedDB reads or writes during generation. */
export const generateStudioScore = async (
  type: ScoreType, song: Song, tracks: StemsRecord['tracks'], previous: StudioScore | undefined,
  onProgress: (p: ScoreProgress) => void, signal?: AbortSignal, deps: Deps = {},
): Promise<StudioScore> => {
  abortIfNeeded(signal);
  const pick = type === 'drums' ? tracks.find(t => t.name === 'drums')
    : type === 'keys' ? tracks.find(t => t.name === 'piano')
      : type === 'guitar' ? tracks.find(t => t.name === 'guitar')
        : tracks.find(t => t.name === 'lead') ?? tracks.find(t => t.name === 'vocals');
  if (!pick) throw new Error('A faixa necessária não está disponível. Termine a separação em Tracks antes de gerar esta partitura.');
  const base: StudioScore = { songId: song.id, notes: [], source: 'lead', model: '', bpm: 120, createdAt: now(), ...previous };
  onProgress({ stage: 'decode', done: 0, total: 1 });
  const decode = deps.decode ?? decodeMono;
  if (type === 'drums') {
    const pcm = await decode(pick.blob, 22050);
    abortIfNeeded(signal);
    onProgress({ stage: 'notes', done: 0, total: 1 });
    const hits = detectDrumHits(pcm, 22050);
    if (!hits.length) throw new Error('Nenhuma batida clara foi encontrada nesta faixa.');
    return { ...base, bpm: previous?.bpm ?? safeBpm(song.tempo, hits.map(h => ({ start: h.time }))), drums: { hits } };
  }
  const vocal = type === 'melody' || type === 'choir';
  let notes = vocal ? previous?.vocalNotes : undefined;
  let model = base.model;
  if (!notes) {
    const pcm = await decode(pick.blob, BASIC_PITCH.SAMPLE_RATE);
    abortIfNeeded(signal);
    const result = await (deps.run ?? runWorker)(pcm, type !== 'guitar', onProgress, signal);
    notes = result.notes; model = result.model;
  }
  abortIfNeeded(signal);
  if (!notes.length) throw new Error('Nenhuma nota clara foi encontrada nesta faixa.');
  const result = { ...base, model, bpm: previous?.bpm ?? safeBpm(song.tempo, notes) };
  if (vocal) {
    const sung = notes.filter(n => n.pitch >= 38 && n.pitch <= 86);
    if (!sung.length) throw new Error('Nenhuma nota vocal clara foi encontrada.');
    if (type === 'melody') return { ...result, vocalNotes: notes, notes: toMelody(sung) };
    return { ...result, vocalNotes: notes, choir: { voices: splitVoices(sung), source: pick.name } };
  }
  if (type === 'guitar') return { ...result, guitar: { notes, source: pick.name } };
  const keys = notes.filter(n => n.pitch >= 33 && n.pitch <= 96);
  if (!keys.length) throw new Error('Nenhuma nota de teclado clara foi encontrada.');
  return { ...result, piano: { notes: keys, source: pick.name } };
};

/** Save all supplied ready parts as one independent library entry, without source audio or raw vocal cache. */
export const saveStudioScores = async (song: Song, score: StudioScore, documents: NonNullable<ScoreRecord['documents']>, grids: NonNullable<ScoreRecord['documentGrids']> = {}, preferredType?: ScoreType): Promise<Song> => {
  const types = SCORE_TYPES.filter(part => !!documents[part.type]).map(part => part.type);
  if (!types.length) throw new Error('Gere pelo menos uma partitura antes de salvar.');
  const type = preferredType && types.includes(preferredType) ? preferredType : types[0]!;
  const stamp = now();
  const saved: Song = { id: crypto.randomUUID(), title: types.length > 1 ? song.title : `${song.title} — ${SCORE_TYPES.find(part => part.type === type)!.label}`, artist: song.artist, key: song.key,
    durationSec: 0, favorite: false, analysisStatus: 'done', createdAt: stamp, updatedAt: stamp };
  const snapshot: ScoreRecord = { songId: saved.id, notes: documents.melody ? score.notes : [],
    source: score.source, bpm: score.bpm, model: score.model, createdAt: stamp, savedType: type, documents: { ...documents }, documentGrids: grids,
    ...(documents.guitar ? { guitar: score.guitar } : {}), ...(documents.keys ? { piano: score.piano } : {}),
    ...(documents.drums ? { drums: score.drums } : {}), ...(documents.choir ? { choir: score.choir } : {}),
  };
  await db.transaction('rw', db.songs, db.scores, async () => { await db.songs.add(saved); await db.scores.add(snapshot); });
  return saved;
};

/** Compatibility for callers explicitly saving a single document. */
export const saveStudioScore = (song: Song, score: StudioScore, type: ScoreType, xml: string, grid?: Grid | null): Promise<Song> =>
  saveStudioScores(song, score, { [type]: xml }, grid ? { [type]: grid } : {}, type);
