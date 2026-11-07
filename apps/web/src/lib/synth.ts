import type { DrumKind } from '@will-music/engine';

/** One sound of the score, in song seconds. */
export type SynthEvent = { time: number; dur: number; pitch?: number; drum?: DrumKind };

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Events starting in [from, to), from a list sorted by time. */
export const eventsInWindow = (events: readonly SynthEvent[], from: number, to: number): SynthEvent[] => {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.time < from) lo = mid + 1;
    else hi = mid;
  }
  const out: SynthEvent[] = [];
  for (let i = lo; i < events.length && events[i]!.time < to; i++) out.push(events[i]!);
  return out;
};

export const toSynthEvents = (input: { notes?: readonly { pitch: number; start: number; end: number }[]; hits?: readonly { time: number; kind: DrumKind }[] }): SynthEvent[] =>
  [
    ...(input.notes ?? []).map((n) => ({ time: n.start, dur: Math.max(0.05, n.end - n.start), pitch: n.pitch })),
    ...(input.hits ?? []).map((h) => ({ time: h.time, dur: 0.2, drum: h.kind })),
  ].sort((a, z) => a.time - z.time);

const LOOKAHEAD = 0.25;
const TICK_MS = 50;

/**
 * Small Web Audio synth that plays the score in step with the player: a soft triangle "piano"
 * for notes and noise/sine voices for drums. No samples to download.
 */
export const createScoreSynth = () => {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let events: SynthEvent[] = [];
  let timer = 0;
  let anchor = { song: 0, clock: 0, rate: 1 };
  let scheduledUntil = 0;
  let volume = 0.7;
  const live = new Set<AudioScheduledSourceNode>();

  const ensure = () => {
    if (context) return context;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return context;
  };

  const track = (node: AudioScheduledSourceNode) => {
    live.add(node);
    node.onended = () => live.delete(node);
  };

  const voice = (e: SynthEvent, at: number, rate: number) => {
    const ctx = context!;
    const out = ctx.createGain();
    out.connect(master!);
    const dur = e.dur / rate;
    if (e.pitch !== undefined) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(e.pitch);
      out.gain.setValueAtTime(0, at);
      out.gain.linearRampToValueAtTime(0.35, at + 0.005);
      out.gain.exponentialRampToValueAtTime(0.12, at + Math.min(0.3, dur));
      out.gain.setValueAtTime(0.12, at + dur);
      out.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.08);
      osc.connect(out);
      osc.start(at);
      osc.stop(at + dur + 0.1);
      track(osc);
      return;
    }
    if (e.drum === 'kick') {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(150, at);
      osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
      out.gain.setValueAtTime(0.9, at);
      out.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
      osc.connect(out);
      osc.start(at);
      osc.stop(at + 0.2);
      track(osc);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = e.drum === 'hihat' ? 7000 : 1200;
    const length = e.drum === 'hihat' ? 0.05 : 0.15;
    out.gain.setValueAtTime(e.drum === 'hihat' ? 0.25 : 0.5, at);
    out.gain.exponentialRampToValueAtTime(0.001, at + length);
    src.connect(filter).connect(out);
    src.start(at);
    src.stop(at + length + 0.02);
    track(src);
  };

  const pump = () => {
    if (!context) return;
    const songNow = anchor.song + (context.currentTime - anchor.clock) * anchor.rate;
    const until = songNow + LOOKAHEAD * anchor.rate;
    for (const e of eventsInWindow(events, Math.max(scheduledUntil, songNow - 0.01), until)) {
      voice(e, anchor.clock + (e.time - anchor.song) / anchor.rate, anchor.rate);
    }
    scheduledUntil = until;
  };

  const silence = () => {
    for (const node of live) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    live.clear();
  };

  return {
    setEvents(next: SynthEvent[]) {
      events = next;
    },
    /** Creates and resumes the audio context; call it inside a tap so iOS lets it make sound. */
    unlock() {
      void ensure().resume();
    },
    setVolume(v: number) {
      volume = v;
      if (master) master.gain.value = v;
    },
    /** Starts (or re-anchors) playback at a song time and speed. */
    play(songTime: number, rate: number) {
      const ctx = ensure();
      void ctx.resume();
      silence();
      anchor = { song: songTime, clock: ctx.currentTime + 0.03, rate };
      scheduledUntil = songTime;
      clearInterval(timer);
      timer = window.setInterval(pump, TICK_MS);
      pump();
    },
    stop() {
      clearInterval(timer);
      silence();
    },
    dispose() {
      clearInterval(timer);
      silence();
      void context?.close();
      context = null;
    },
  };
};
