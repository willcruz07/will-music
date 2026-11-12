/// <reference lib="webworker" />
import { analyzeChords, resample, toDisplayLabel, verifyCqtPlan } from '@will-music/engine';
import { fetchModel } from '../lib/models.ts';
import { createWebRunner } from '../lib/webRunner.ts';

export type LiveChordsRequest = { type: 'start'; sampleRate: number } | { type: 'audio'; samples: Float32Array } | { type: 'stop' };
export type LiveChordsResponse = { type: 'ready' } | { type: 'chord'; label: string | null } | { type: 'error'; message: string };

const post = (m: LiveChordsResponse) => (self as DedicatedWorkerGlobalScope).postMessage(m);
const WINDOW_SEC = 5;

let rate = 48000;
let ring = new Float32Array(0);
let filled = 0;
let timer = 0;
let busy = false;
let model: { plan: Awaited<ReturnType<typeof verifyCqtPlan>>; runner: Awaited<ReturnType<typeof createWebRunner>> } | null = null;

/** Every second, the last five seconds heard are run through the chord model; the chord at the end is what is playing now. */
const analyze = async () => {
  if (busy || !model || filled < rate * 2) return;
  busy = true;
  try {
    const recent = ring.subarray(Math.max(0, filled - ring.length), filled);
    const tail = recent.subarray(Math.max(0, recent.length - rate * 0.5));
    let energy = 0;
    for (const value of tail) energy += value * value;
    if (Math.sqrt(energy / Math.max(1, tail.length)) < 0.01) { post({ type: 'chord', label: null }); return; }
    const segments = await analyzeChords(resample(recent.slice(), rate, 22050), model.plan, model.runner);
    const end = recent.length / rate;
    // Inference can outlast a change to silence; don't display the old chord afterward.
    let liveEnergy = 0;
    const liveTail = ring.subarray(Math.max(0, filled - Math.round(rate * 0.5)), filled);
    for (const value of liveTail) liveEnergy += value * value;
    if (Math.sqrt(liveEnergy / Math.max(1, liveTail.length)) < 0.01) { post({ type: 'chord', label: null }); return; }
    const now = [...segments].reverse().find((s) => s.start < end - 0.4);
    post({ type: 'chord', label: now && now.raw !== 'N' && now.raw !== 'X' ? toDisplayLabel(now.raw) : null });
  } catch (e) {
    clearInterval(timer);
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  } finally {
    busy = false;
  }
};

self.onmessage = async (event: MessageEvent<LiveChordsRequest>) => {
  const msg = event.data;
  if (msg.type === 'start') {
    rate = msg.sampleRate;
    ring = new Float32Array(rate * WINDOW_SEC);
    filled = 0;
    try {
      model ??= { plan: await verifyCqtPlan(await fetchModel('cqtPlan')), runner: await createWebRunner(await fetchModel('chordnet')) };
      post({ type: 'ready' });
      clearInterval(timer);
      timer = self.setInterval(() => void analyze(), 1000);
    } catch (e) {
      post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  } else if (msg.type === 'audio') {
    // Keep only the last WINDOW_SEC seconds, oldest first.
    const s = msg.samples;
    if (filled + s.length > ring.length) {
      const keep = Math.max(0, ring.length - s.length);
      ring.copyWithin(0, filled - keep, filled);
      filled = keep;
    }
    ring.set(s.subarray(Math.max(0, s.length - ring.length)), filled);
    filled = Math.min(ring.length, filled + s.length);
  } else {
    clearInterval(timer);
  }
};
