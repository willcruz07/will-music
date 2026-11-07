/// <reference lib="webworker" />
import { MODELS, type NoteEvent, extractNotes, modelVersion, runBasicPitch, toMelody } from '@will-music/engine';
import { fetchModel } from '../lib/models.ts';
import { createWebRunner } from '../lib/webRunner.ts';

/** poly: keep every note (keyboard score); otherwise reduce to the melody line. */
export type TranscriptionRequest = { type: 'transcribe'; pcm: Float32Array; poly?: boolean };
export type TranscriptionResponse =
  | { type: 'progress'; stage: 'models' | 'notes'; done: number; total: number }
  | { type: 'result'; notes: NoteEvent[]; model: string }
  | { type: 'error'; message: string };

const post = (message: TranscriptionResponse) => (self as DedicatedWorkerGlobalScope).postMessage(message);

self.onmessage = async (event: MessageEvent<TranscriptionRequest>) => {
  if (event.data.type !== 'transcribe') return;
  try {
    const bytes = await fetchModel('basicPitch', (loaded) => post({ type: 'progress', stage: 'models', done: loaded, total: MODELS.basicPitch.bytes }));
    const runner = await createWebRunner(bytes);
    try {
      const posteriors = await runBasicPitch(event.data.pcm, runner, (done, total) => post({ type: 'progress', stage: 'notes', done, total }));
      const notes = extractNotes(posteriors);
      post({ type: 'result', notes: event.data.poly ? notes : toMelody(notes), model: modelVersion('basicPitch') });
    } finally {
      await runner.release();
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
