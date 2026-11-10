import type { WhisperRequest, WhisperResponse } from '../worker/whisper.worker.ts';
import { db } from './db.ts';
import { notifyModelsChanged } from './modelsReminder.ts';
import { findVoiceTracks, getStems } from './stems.ts';
import { getSessionStems } from './sessionStems.ts';
import { type TranscribeProgress, type WhisperChunk, isUsefulTranscript, leadingSilence, transcriptToLines, wordsToSegments } from './transcript.ts';
import type { LyricLine, StemsRecord } from './db.ts';
import { type WhisperDevice, detectWhisperDevice, whisperCacheReady } from './whisperModel.ts';

const RATE = 16000;

const decodeMono16k = async (blob: Blob): Promise<Float32Array> => {
  const context = new OfflineAudioContext(1, 1, RATE);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] = out[i]! + data[i]! / buffer.numberOfChannels;
  }
  return out;
};

const runWhisper = (
  audio: Float32Array,
  cached: boolean,
  onProgress: (p: TranscribeProgress) => void,
  signal?: AbortSignal,
): Promise<{ chunks: WhisperChunk[]; device: string; words: boolean }> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const worker = new Worker(new URL('../worker/whisper.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { signal?.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(signal?.reason ?? new DOMException('Transcrição cancelada.', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<WhisperResponse>) => {
      const msg = event.data;
      // A model already on the device also reports file progress while it is read: that is not a download.
      if (msg.type === 'progress') return onProgress(cached ? { stage: 'load' } : { stage: 'download', loaded: msg.loaded, total: msg.total });
      if (msg.type === 'transcribing') return onProgress({ stage: 'listen', done: msg.done, total: msg.total, heard: msg.heard });
      cleanup();
      if (msg.type === 'result') resolve(msg);
      else reject(new Error(msg.type === 'error' ? msg.message : 'A transcrição falhou.'));
    };
    worker.onerror = (e) => {
      cleanup();
      reject(new Error(e.message || 'A transcrição falhou.'));
    };
    const request: WhisperRequest = { type: 'transcribe', audio };
    try { worker.postMessage(request, [audio.buffer]); }
    catch (error) { cleanup(); reject(error); }
  });

export { WHISPER_BYTES, detectWhisperDevice, whisperModelFor } from './whisperModel.ts';

/** True when the Whisper model this device uses is already in the browser cache (transformers.js keeps it in "transformers-cache"). */
export const whisperCached = async (device?: WhisperDevice): Promise<boolean> => {
  return whisperCacheReady(device ?? await detectWhisperDevice());
};

/** Downloads and caches the Whisper model without transcribing (first-run setup). */
export const preloadWhisper = (onProgress: (loaded: number, total: number) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/whisper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (event: MessageEvent<WhisperResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress(msg.loaded, msg.total);
      worker.terminate();
      if (msg.type === 'ready') {
        if (!(await whisperCached(msg.device))) {
          reject(new Error('O modelo da letra carregou, mas não ficou completamente guardado no navegador. O armazenamento foi recusado; a próxima transcrição poderá precisar baixar os arquivos novamente.'));
          return;
        }
        notifyModelsChanged();
        resolve();
      }
      else reject(new Error(msg.type === 'error' ? msg.message : 'O modelo da letra não carregou.'));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'O modelo da letra não carregou.'));
    };
    const request: WhisperRequest = { type: 'preload' };
    worker.postMessage(request);
  });

/** Transcribes the song (separated vocals when available) into timed lyric lines; throws when nothing useful is heard. */
export const transcribeSong = async (
  songId: string,
  onProgress: (p: TranscribeProgress) => void,
  source?: { stems?: StemsRecord; original?: boolean; signal?: AbortSignal },
): Promise<{ lines: LyricLine[]; usedVocals: boolean }> => {
  source?.signal?.throwIfAborted();
  const cached = await whisperCached();
  onProgress(cached ? { stage: 'load' } : { stage: 'download', loaded: 0, total: 0 });
  const stems = source?.original ? undefined : source?.stems ?? getSessionStems(songId) ?? await getStems(songId);
  const vocalTracks = findVoiceTracks(stems);
  let audio: Float32Array;
  if (vocalTracks.length) {
    audio = new Float32Array(0);
    for (const track of vocalTracks) {
      const part = await decodeMono16k(track.blob);
      if (part.length > audio.length) { const larger = new Float32Array(part.length); larger.set(audio); audio = larger; }
      for (let i = 0; i < part.length; i++) audio[i] = audio[i]! + part[i]!;
    }
  } else {
    const original = await db.audio.get(songId);
    if (!original) throw new Error('Esta música não tem áudio para transcrever.');
    audio = await decodeMono16k(original.blob);
  }
  // Skip the silent intro: Whisper tends to loop on a made-up phrase over silence. Timestamps are shifted back.
  source?.signal?.throwIfAborted();
  const offset = leadingSilence(audio, RATE);
  const { chunks: raw, words } = await runWhisper(offset ? audio.slice(Math.round(offset * RATE)) : audio, cached, onProgress, source?.signal);
  const chunks = words ? wordsToSegments(raw) : raw;
  const lines = transcriptToLines(chunks.map((c) => ({
    text: c.text,
    timestamp: [c.timestamp[0] + offset, c.timestamp[1] === null ? null : c.timestamp[1] + offset] as WhisperChunk['timestamp'],
  })));
  if (!isUsefulTranscript(lines)) throw new Error('Não deu para entender a letra neste áudio.');
  return { lines, usedVocals: vocalTracks.length > 0 };
};
