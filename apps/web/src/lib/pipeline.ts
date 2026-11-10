import { analyzeInWorker } from '../worker/client.ts';
import { buildChart, keyToChord } from './chart.ts';
import { type Analysis, type Chart, db, now, updateSong } from './db.ts';
import { decodeForAnalysis } from './decode.ts';
import { retainSessionStems } from './sessionStems.ts';
import { lyricsToKeep } from './lyricsApply.ts';
import { transcribeSong } from './whisper.ts';
import { describeTranscription } from './transcript.ts';
import { getPendingAnalysis, setPendingAnalysis, retainSessionAnalysis } from './pendingAnalysis.ts';
import { savePendingAnalysis } from './saveAnalysis.ts';
import { isQuotaError } from './storage.ts';
import { estimateAudioBpm } from './audioTempo.ts';

import { resolveAnalysisExecution, isResourceFailure, type ExecutionPreference } from './analysisExecution.ts';
export type AnalysisTaskProgress = { id: 'chords' | 'lyrics'; label: string; detail?: string; fraction?: number; status: 'waiting' | 'running' | 'done' | 'error' | 'skipped' };
/** Two independent task snapshots, plus the already-published chord chart while lyrics finish. */
export type PipelineProgress = { label: string; fraction?: number; detail?: string; lyricsPending?: boolean; tasks?: AnalysisTaskProgress[]; tempo?: number };
const mb = (bytes: number) => (bytes / 1e6).toFixed(0);

export const runPipeline = async (songId: string, onProgress: (p: PipelineProgress) => void, options: { execution?: ExecutionPreference; persist?: boolean } = {}): Promise<void> => {
  const song = await db.songs.get(songId);
  const audio = await db.audio.get(songId);
  if (!song || !audio) throw new Error('Música não encontrada.');
  if (options.persist !== false) await updateSong(songId, { analysisStatus: 'running', analysisError: undefined });
  const release = retainSessionStems(songId);
  const releaseAnalysis = retainSessionAnalysis(songId);
  const controller = new AbortController();
  let stopped = false;
  let assembling = false;
  let chartPublished = false;
  const started = performance.now();
  let chordsMs = 0;
  let lyricsMs = 0;
  let transcriptionRetried = false;
  try {
    const execution = await resolveAnalysisExecution(options.execution);
    const warnings: string[] = [];
    const previous = await db.analyses.where('songId').equals(songId).first();
    let lyrics = lyricsToKeep(previous?.lyrics);
    let tempo = song.tempo;
    const chordsTask: AnalysisTaskProgress = { id: 'chords', label: 'Preparando o áudio dos acordes', status: 'running' };
    const lyricsTask: AnalysisTaskProgress = { id: 'lyrics', label: lyrics?.lines.length ? 'Letra preservada' : 'Aguardando a transcrição', status: lyrics?.lines.length ? 'skipped' : 'waiting' };
    const snapshot = () => [{ ...chordsTask }, { ...lyricsTask }];
    const publish = () => {
      if (stopped || controller.signal.aborted || assembling) return;
      const active = chordsTask.status === 'running' ? chordsTask : lyricsTask;
      const both = chordsTask.status === 'running' && lyricsTask.status === 'running';
      onProgress({ label: both ? 'Analisando acordes e transcrevendo a letra…' : active.label, detail: active.detail, fraction: active.fraction, lyricsPending: chartPublished && lyricsTask.status === 'running', tasks: snapshot(), tempo });
    };
    publish();
    // Decode the chord input first; do not overlap two full native audio decoders on long files.
    const { channels, durationSec } = await decodeForAnalysis(audio.blob, { mono: true });
    tempo = song.tempo ?? (channels[0] ? estimateAudioBpm(channels[0], 22050) : undefined);
    publish();
    let lyricsFailure: unknown;
    let lyricsPromise: Promise<void> | undefined;
    const launchLyrics = () => {
      const taskStarted = performance.now();
      lyricsFailure = undefined;
      lyricsTask.status = 'running';
      lyricsTask.label = transcriptionRetried ? 'Tentando a transcrição sem concorrência…' : 'Transcrevendo a letra…';
      lyricsTask.fraction = undefined;
      lyricsTask.detail = undefined;
      publish();
      lyricsPromise = transcribeSong(songId, (p) => { Object.assign(lyricsTask, describeTranscription(p)); publish(); }, { original: true, signal: controller.signal })
        .then((heard) => { lyrics = { source: 'transcription', lines: heard.lines }; lyricsTask.status = 'done'; lyricsTask.label = 'Letra transcrita'; lyricsTask.fraction = 1; })
        .catch((error: unknown) => { if (!controller.signal.aborted) { lyricsFailure = error; lyricsTask.status = 'error'; lyricsTask.label = 'A transcrição não terminou'; } })
        .finally(() => { lyricsMs += performance.now() - taskStarted; publish(); });
    };
    const chordPromise = analyzeInWorker(channels, (e) => {
      chordsTask.label = e.stage === 'models' ? 'Carregando modelos de acordes (' + mb(e.done) + ' de ' + mb(e.total) + ' MB)' : e.stage === 'key' ? 'Identificando o tom…' : 'Analisando acordes… (bloco ' + Math.min(e.total, e.done + 1) + ' de ' + e.total + ')';
      chordsTask.detail = e.detail;
      chordsTask.fraction = e.total ? e.done / e.total : undefined;
      publish();
    }, controller.signal);
    if (execution === 'parallel' && !lyrics?.lines.length) launchLyrics();
    const result = await chordPromise;
    chordsMs = performance.now() - started;
    chordsTask.status = 'done'; chordsTask.label = 'Tom e acordes prontos'; chordsTask.fraction = 1;
    const saveResult = async () => {
      assembling = true;
      onProgress({ label: 'Montando sua música…', tasks: snapshot() });
      // A user may have corrected lyrics in another view while the models were running.
      const latest = await db.analyses.where('songId').equals(songId).first();
      lyrics = lyricsToKeep(latest?.lyrics) ?? lyrics;
      const lines = lyrics?.lines ?? [];

      const stamp = now();
      const analysis: Analysis = {
        id: crypto.randomUUID(),
        songId,
        schemaVersion: 1,
        models: { ...result.models, audioSource: 'original' },
        key: result.key,
        chords: result.chords,
        lyrics,
        warnings,
        processing: { execution, chordsMs, lyricsMs, totalMs: performance.now() - started, transcriptionRetried },
        createdAt: stamp,
        updatedAt: stamp,
    };
    const chordPro = buildChart({ title: song.title, artist: song.artist, key: result.key, chords: result.chords, lines });

    const existing = getPendingAnalysis(songId)?.chart ?? await db.charts.where('songId').equals(songId).first();
    const chart: Chart = existing && existing.origin !== 'generated' ? existing : {
      id: existing?.id ?? crypto.randomUUID(), songId, transpose: existing?.transpose ?? 0, fontSize: existing?.fontSize ?? 18,
      chordPro, lineTimes: lines.map((line) => line.start), origin: 'generated', generatedFromAnalysisId: analysis.id,
      createdAt: existing?.createdAt ?? stamp, updatedAt: stamp,
    };
    setPendingAnalysis({ analysis, chart, sessionOnly: options.persist === false, song: { ...song, tempo, key: keyToChord(result.key), durationSec: song.durationSec || durationSec, analysisStatus: 'done', analysisError: undefined, updatedAt: stamp } });
    try { if (options.persist !== false) await savePendingAnalysis(songId); }
    catch (error) {
      if (!isQuotaError(error)) throw error;
      console.warn('Análise concluída, mas a gravação foi recusada. Resultado preservado na sessão.', { songId, error });
    }

      assembling = false;
    };
    if (!lyrics?.lines.length && (lyricsTask.status === 'running' || execution === 'sequential')) {
      await saveResult();
      chartPublished = true;
      if (execution === 'sequential') launchLyrics();
      publish();
    }
    await lyricsPromise;
    // A resource-related overlap failure gets one isolated retry after the chord worker has ended.
    if (execution === 'parallel' && lyricsFailure && isResourceFailure(lyricsFailure)) {
      if (!chartPublished) { await saveResult(); chartPublished = true; }
      transcriptionRetried = true;
      launchLyrics();
      await lyricsPromise;
    }
    if (lyricsFailure) {
      warnings.push('Não foi possível transcrever a letra. Você pode tentar novamente ou inserir a letra manualmente.');
      console.warn('Transcrição automática da letra não deu certo', lyricsFailure);
    }
    await saveResult();
  } catch (error) {
    controller.abort();
    const message = error instanceof Error ? error.message : String(error);
    try { if (options.persist !== false) await updateSong(songId, { analysisStatus: 'error', analysisError: message }); }
    catch (statusError) { console.warn('Não foi possível registrar o estado de erro da análise.', { songId, error, statusError }); }
    throw error;
  } finally {
    stopped = true;
    controller.abort();
    release();
    releaseAnalysis();
  }
};
