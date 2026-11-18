import { createSeparationReporter } from './separationProgress.ts';
import { analyzeInWorker } from '../worker/client.ts';
import { buildChart, keyToChord } from './chart.ts';
import { type Analysis, type Chart, db, now, updateSong } from './db.ts';
import { decodeForAnalysis, decodeStudioAudio } from './decode.ts';
import { retainSessionStems } from './sessionStems.ts';
import { lyricsToKeep } from './lyricsApply.ts';
import { transcribeSong, warmWhisper, type WhisperWarm } from './whisper.ts';
import { findSongLyrics } from './lrclib.ts';
import { chooseLyrics } from './lyricsChoice.ts';
import { describeTranscription } from './transcript.ts';
import { getPendingAnalysis, setPendingAnalysis, retainSessionAnalysis } from './pendingAnalysis.ts';
import { savePendingAnalysis } from './saveAnalysis.ts';
import { isQuotaError } from './storage.ts';
import { estimateAudioBpm } from './audioTempo.ts';
import { prepareAnalysisStems, separationNeeded } from './analysisAudio.ts';
import { isMobileStudio } from './studioDevice.ts';

import { resolveAnalysisExecution, isResourceFailure, type ExecutionPreference } from './analysisExecution.ts';
export type AnalysisTaskProgress = { id: 'tracks' | 'chords' | 'lyrics'; label: string; detail?: string; fraction?: number; status: 'waiting' | 'running' | 'done' | 'error' | 'skipped' };
/** Ordered task snapshots, plus the published chord chart while lyrics finish. */
export type PipelineProgress = { label: string; fraction?: number; detail?: string; lyricsPending?: boolean; tasks?: AnalysisTaskProgress[]; tempo?: number };
const mb = (bytes: number) => (bytes / 1e6).toFixed(0);

export const runPipeline = async (songId: string, onProgress: (p: PipelineProgress) => void, options: { execution?: ExecutionPreference; persist?: boolean; signal?: AbortSignal; taskSignals?: Partial<Record<'tracks' | 'lyrics', AbortSignal>> } = {}): Promise<void> => {
  const song = await db.songs.get(songId);
  const audio = await db.audio.get(songId);
  if (!song || !audio) throw new Error('Música não encontrada.');
  if (options.persist !== false) await updateSong(songId, { analysisStatus: 'running', analysisError: undefined });
  const release = retainSessionStems(songId);
  const releaseAnalysis = retainSessionAnalysis(songId);
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel(); else options.signal?.addEventListener('abort', cancel, { once: true });
  // A step the musician stopped: it ends on its own signal, the rest of the analysis keeps going.
  const stepSignal = (task: 'tracks' | 'lyrics') => options.taskSignals?.[task] ? AbortSignal.any([controller.signal, options.taskSignals[task]!]) : controller.signal;
  const stepCancelled = (task: 'tracks' | 'lyrics') => !!options.taskSignals?.[task]?.aborted && !controller.signal.aborted;
  let stopped = false;
  let assembling = false;
  let chartPublished = false;
  const started = performance.now();
  let chordsMs = 0;
  let lyricsMs = 0;
  let transcriptionRetried = false;
  let warm: WhisperWarm | null = null;
  try {
    const execution = await resolveAnalysisExecution(options.execution);
    const mobile = isMobileStudio();
    const warnings: string[] = [];
    const previous = await db.analyses.where('songId').equals(songId).first();
    let lyrics = lyricsToKeep(previous?.lyrics);
    let tempo = song.tempo;
    const tracksTask: AnalysisTaskProgress = { id: 'tracks', label: mobile ? 'Usando o áudio original' : 'Separando faixas da música…', status: mobile ? 'skipped' : 'running' };
    // The chords read the original mix on the processor; they do not wait for the tracks (separated on the GPU).
    const chordsTask: AnalysisTaskProgress = { id: 'chords', label: 'Preparando o áudio dos acordes', status: 'running' };
    const lyricsTask: AnalysisTaskProgress = { id: 'lyrics', label: lyrics?.lines.length ? 'Letra preservada' : 'Aguardando a voz separada', status: lyrics?.lines.length ? 'skipped' : 'waiting' };
    if (mobile) { lyricsTask.status = lyrics?.lines.length ? 'skipped' : 'waiting'; lyricsTask.label = lyrics?.lines.length ? 'Letra preservada' : 'Aguardando para buscar a letra'; }
    const snapshot = () => [{ ...tracksTask }, { ...chordsTask }, { ...lyricsTask }];
    const publish = () => {
      if (stopped || controller.signal.aborted || assembling) return;
      const running = [tracksTask, chordsTask, lyricsTask].filter((t) => t.status === 'running');
      // Once the chart is out, the bar follows what is still to come: the tracks, then the lyrics.
      const active = chartPublished
        ? (lyricsTask.status === 'running' ? lyricsTask : tracksTask.status === 'running' ? tracksTask : lyricsTask)
        : running[0] ?? lyricsTask;
      const label = !chartPublished && tracksTask.status === 'running' && chordsTask.status === 'running' ? 'Separando faixas e analisando acordes…'
        : !chartPublished && chordsTask.status === 'running' && lyricsTask.status === 'running' ? 'Analisando acordes e transcrevendo a letra…'
        : active.label;
      const stillComing = lyricsTask.status === 'running' || lyricsTask.status === 'waiting' || tracksTask.status === 'running';
      onProgress({ label, detail: active.detail, fraction: active.fraction, lyricsPending: chartPublished && stillComing, tasks: snapshot(), tempo });
    };
    publish();
    // Decode the chord input first; do not overlap two full native audio decoders on long files (the separation
    // decodes its own copy right after).
    let forSeparation: { planar: Float32Array; samples: number } | undefined;
    const decoded = !mobile && await separationNeeded(songId)
      ? await decodeStudioAudio(audio.blob).then((d) => { forSeparation = d.separation; return d.chords; })
      : await decodeForAnalysis(audio.blob, { mono: true });
    const { channels, durationSec } = decoded;
    tempo = song.tempo ?? (channels[0] ? estimateAudioBpm(channels[0], 22050) : undefined);
    publish();
    let lyricsFailure: unknown;
    let lyricsPromise: Promise<void> | undefined;
    // Desktop: the lyric text from LRCLIB (one request, started now) is placed on the times Whisper hears.
    const lrclibPromise = !mobile && !lyrics?.lines.length
      ? findSongLyrics(song.title, song.artist, song.durationSec || durationSec).catch((error: unknown) => { console.warn('Busca da letra no LRCLIB falhou', error); return null; })
      : Promise.resolve(null);
    const launchLyrics = () => {
      const taskStarted = performance.now();
      lyricsFailure = undefined;
      lyricsTask.status = 'running';
      lyricsTask.label = transcriptionRetried ? 'Tentando a transcrição sem concorrência…' : 'Transcrevendo a letra…';
      lyricsTask.fraction = undefined;
      lyricsTask.detail = undefined;
      publish();
      lyricsPromise = transcribeSong(songId, (p) => { Object.assign(lyricsTask, describeTranscription(p)); publish(); }, { signal: stepSignal('lyrics'), warm: warm ?? undefined })
        .then(async (heard) => {
          const chosen = chooseLyrics(await lrclibPromise, heard, song.durationSec || durationSec)!;
          lyrics = chosen.lyrics;
          lyricsTask.label = chosen.label;
          lyricsTask.status = 'done'; lyricsTask.fraction = 1;
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (stepCancelled('lyrics')) { lyricsTask.status = 'skipped'; lyricsTask.label = 'Letra cancelada'; lyricsTask.detail = undefined; return; }
          lyricsFailure = error; lyricsTask.status = 'error'; lyricsTask.label = 'A transcrição não terminou';
        })
        .finally(() => { lyricsMs += performance.now() - taskStarted; publish(); });
    };
    // Desktop: the lyrics model loads in its own worker while the tracks are separated, so the transcription starts
    // as soon as the voice is ready. "Sequential" (weaker machines) skips it to keep one model in memory at a time.
    warm = !mobile && !lyrics?.lines.length && execution === 'parallel' ? warmWhisper() : null;
    warm?.listen((msg) => {
      if (lyricsTask.status !== 'waiting') return;
      if (msg.type === 'warmed') lyricsTask.label = msg.ok ? 'Modelo da letra pronto, aguardando a voz separada' : 'Aguardando a voz separada';
      else if (msg.type === 'progress' && lyricsTask.label === 'Aguardando a voz separada') lyricsTask.label = 'Preparando o modelo da letra enquanto as faixas são separadas';
      else return;
      publish();
    });
    options.taskSignals?.lyrics?.addEventListener('abort', () => {
      warm?.dispose();
      if (lyricsTask.status !== 'waiting') return;
      lyricsTask.status = 'skipped'; lyricsTask.label = 'Letra cancelada';
      publish();
    }, { once: true });
    const chordsStarted = performance.now();
    const chordPromise = analyzeInWorker(channels, (e) => {
      chordsTask.label = e.stage === 'models' ? 'Carregando modelos de acordes (' + mb(e.done) + ' de ' + mb(e.total) + ' MB)' : e.stage === 'key' ? 'Identificando o tom…' : 'Analisando acordes… (bloco ' + Math.min(e.total, e.done + 1) + ' de ' + e.total + ')';
      chordsTask.detail = e.detail;
      chordsTask.fraction = e.total ? e.done / e.total : undefined;
      publish();
    }, controller.signal);
    const chordsDone = chordPromise.then((r) => {
      chordsMs = performance.now() - chordsStarted;
      chordsTask.status = 'done'; chordsTask.label = 'Tom e acordes prontos'; chordsTask.fraction = 1; chordsTask.detail = undefined;
      publish();
      return r;
    });
    const separation = mobile ? Promise.resolve() : (async () => {
      try {
        const report = createSeparationReporter();
        const prepared = await prepareAnalysisStems(songId, p => {
          Object.assign(tracksTask, report(p));
          publish();
        }, stepSignal('tracks'), forSeparation);
        forSeparation = undefined;
        if (prepared.warning) warnings.push(prepared.warning);
        tracksTask.status = prepared.stems ? 'done' : 'skipped';
        tracksTask.label = prepared.stems ? 'Faixas prontas' : 'Continuando com o áudio original';
      } catch (error) {
        controller.signal.throwIfAborted();
        if (stepCancelled('tracks')) {
          tracksTask.status = 'skipped';
          tracksTask.label = 'Separação cancelada';
          tracksTask.detail = undefined; tracksTask.fraction = undefined;
          publish();
          return;
        }
        tracksTask.status = 'error';
        tracksTask.label = 'Separação indisponível';
        warnings.push('Não foi possível separar as faixas. A letra continua com o áudio original.');
        console.warn('Separação inicial não terminou', error);
      }
      tracksTask.detail = undefined;
      tracksTask.fraction = undefined;
      publish();
    })();
    // Whisper listens to the separated voice: it starts when the tracks are ready (and, on "sequential", after the chords).
    const lyricsStart = separation.then(async () => {
      if (mobile || lyrics?.lines.length) return;
      if (execution === 'sequential') await chordsDone.catch(() => undefined);
      controller.signal.throwIfAborted();
      if (stepCancelled('lyrics')) return;
      launchLyrics();
    });
    // Awaited below; a failure here must not surface as an unhandled rejection while the chords still run.
    lyricsStart.catch(() => undefined);
    // On phones no model transcribes (it does not fit in memory): the lyrics come from LRCLIB, a single request.
    if (mobile && !lyrics?.lines.length) {
      const taskStarted = performance.now();
      lyricsTask.status = 'running'; lyricsTask.label = 'Buscando a letra…'; publish();
      lyricsPromise = findSongLyrics(song.title, song.artist, song.durationSec || durationSec)
        .catch((error: unknown) => { console.warn('Busca da letra no LRCLIB falhou', error); return null; })
        .then((found) => {
          if (stepCancelled('lyrics')) { lyricsTask.status = 'skipped'; lyricsTask.label = 'Letra cancelada'; return; }
          if (found) {
            lyrics = found;
            if (found.warning) warnings.push(found.warning);
            lyricsTask.status = 'done'; lyricsTask.label = 'Letra encontrada';
          } else {
            warnings.push('Não encontramos a letra desta música. Você pode colar a letra na cifra; a transcrição automática está disponível no computador.');
            lyricsTask.status = 'skipped'; lyricsTask.label = 'Letra não encontrada';
          }
        })
        .finally(() => { lyricsMs += performance.now() - taskStarted; publish(); });
    }
    const result = await chordsDone;
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
    // The chart (chords, and lyrics once they come) shows while the tracks and the transcription finish.
    if (!mobile && (tracksTask.status === 'running' || lyricsTask.status === 'waiting' || lyricsTask.status === 'running')) {
      await saveResult();
      chartPublished = true;
      publish();
    }
    await lyricsStart;
    await lyricsPromise;
    // A resource-related overlap failure gets one isolated retry after the chord worker has ended.
    if (execution === 'parallel' && lyricsFailure && isResourceFailure(lyricsFailure)) {
      if (!chartPublished) { await saveResult(); chartPublished = true; }
      transcriptionRetried = true;
      launchLyrics();
      await lyricsPromise;
    }
    if (lyricsFailure) {
      // Whisper could not finish: LRCLIB's lyrics (with their own times) still fill the chart.
      const found = await lrclibPromise;
      if (found) {
        lyrics = found;
        if (found.warning) warnings.push(found.warning);
        lyricsTask.status = 'done'; lyricsTask.label = 'Letra encontrada';
        lyricsFailure = undefined;
      }
    }
    if (lyricsFailure) {
      warnings.push('Não foi possível transcrever a letra. Você pode tentar novamente ou inserir a letra manualmente.');
      console.warn('Transcrição automática da letra não deu certo', lyricsFailure);
    }
    await saveResult();
  } catch (error) {
    controller.abort();
    if (options.signal?.aborted) {
      if (options.persist !== false) await updateSong(songId, { analysisStatus: 'pending', analysisError: undefined }).catch(() => undefined);
      throw new DOMException('Análise cancelada.', 'AbortError');
    }
    const message = error instanceof Error ? error.message : String(error);
    try { if (options.persist !== false) await updateSong(songId, { analysisStatus: 'error', analysisError: message }); }
    catch (statusError) { console.warn('Não foi possível registrar o estado de erro da análise.', { songId, error, statusError }); }
    throw error;
  } finally {
    stopped = true;
    options.signal?.removeEventListener('abort', cancel);
    warm?.dispose();
    controller.abort();
    release();
    releaseAnalysis();
  }
};
