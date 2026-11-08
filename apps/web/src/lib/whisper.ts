import type { WhisperRequest, WhisperResponse } from '../worker/whisper.worker.ts';
import { db } from './db.ts';
import { findVoiceTracks, getStems } from './stems.ts';
import { type WhisperChunk, isUsefulTranscript, transcriptToLines } from './transcript.ts';
import type { LyricLine } from './db.ts';

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

const runWhisper = (audio: Float32Array, onProgress: (loaded: number, total: number) => void): Promise<{ chunks: WhisperChunk[]; device: string }> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/whisper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WhisperResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress(msg.loaded, msg.total);
      worker.terminate();
      if (msg.type === 'result') resolve(msg);
      else reject(new Error(msg.type === 'error' ? msg.message : 'A transcrição falhou.'));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'A transcrição falhou.'));
    };
    const request: WhisperRequest = { type: 'transcribe', audio };
    worker.postMessage(request, [audio.buffer]);
  });

const WHISPER_MODEL = 'whisper-small_timestamped';

/** True when the Whisper model is already in the browser cache (transformers.js keeps it in "transformers-cache"). */
export const whisperCached = async (): Promise<boolean> => {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open('transformers-cache');
    return (await cache.keys()).some((r) => r.url.includes(WHISPER_MODEL));
  } catch {
    return false;
  }
};

/** Downloads and caches the Whisper model without transcribing (first-run setup). */
export const preloadWhisper = (onProgress: (loaded: number, total: number) => void): Promise<void> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/whisper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WhisperResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress(msg.loaded, msg.total);
      worker.terminate();
      if (msg.type === 'ready') resolve();
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
  onProgress: (loaded: number, total: number) => void,
): Promise<{ lines: LyricLine[]; usedVocals: boolean }> => {
  const stems = await getStems(songId);
  const vocalTracks = findVoiceTracks(stems);
  let audio: Float32Array;
  if (vocalTracks.length) {
    const parts = await Promise.all(vocalTracks.map((t) => decodeMono16k(t.blob)));
    audio = new Float32Array(Math.max(...parts.map((p) => p.length)));
    for (const p of parts) for (let i = 0; i < p.length; i++) audio[i] = audio[i]! + p[i]!;
  } else {
    const original = await db.audio.get(songId);
    if (!original) throw new Error('Esta música não tem áudio para transcrever.');
    audio = await decodeMono16k(original.blob);
  }
  const { chunks } = await runWhisper(audio, onProgress);
  const lines = transcriptToLines(chunks);
  if (!isUsefulTranscript(lines)) throw new Error('Não deu para entender a letra neste áudio.');
  return { lines, usedVocals: vocalTracks.length > 0 };
};
