import { describe, expect, it } from 'vitest';
import type { TensorFeed, TensorRunner } from '../src/inference/runner.ts';
import { BASIC_PITCH, type Posteriors, runBasicPitch } from '../src/score/basicPitch.ts';
import { extractNotes, toMelody } from '../src/score/notes.ts';

const { WINDOW, HOP, FRAMES_PER_WINDOW, BINS, HOP_SAMPLES, SAMPLE_RATE } = BASIC_PITCH;

/** Fake model: every frame of window k holds k (note) and the frame index (onset). */
const fakeRunner = (calls: TensorFeed[]): TensorRunner => ({
  async run(feeds) {
    const feed = Object.values(feeds)[0]!;
    calls.push(feed);
    const k = calls.length - 1;
    const note = new Float32Array(FRAMES_PER_WINDOW * BINS).fill(k);
    const onset = new Float32Array(FRAMES_PER_WINDOW * BINS);
    for (let f = 0; f < FRAMES_PER_WINDOW; f++) onset.fill(f, f * BINS, (f + 1) * BINS);
    return { [BASIC_PITCH.NOTE_OUTPUT]: note, [BASIC_PITCH.ONSET_OUTPUT]: onset, 'StatefulPartitionedCall:0': new Float32Array(FRAMES_PER_WINDOW * 264) };
  },
  release: async () => {},
});

const empty = (frames: number): Posteriors => ({ frames, note: new Float32Array(frames * BINS), onset: new Float32Array(frames * BINS) });

const paint = (p: Posteriors, bin: number, from: number, to: number, level = 0.8) => {
  for (let f = from; f < to; f++) p.note[f * BINS + bin] = level;
  p.onset[from * BINS + bin] = 0.9;
};

describe('runBasicPitch', () => {
  it('windows the audio and keeps one frame per 256 samples', async () => {
    const len = 100000;
    const calls: TensorFeed[] = [];
    const p = await runBasicPitch(new Float32Array(len), fakeRunner(calls));
    expect(calls).toHaveLength(Math.ceil((len + 3840) / HOP));
    expect(calls[0]!.dims).toEqual([1, WINDOW, 1]);
    expect(p.frames).toBe(Math.floor(len / HOP_SAMPLES));
    expect(p.note.length).toBe(p.frames * BINS);
  });

  it('stitches the central frames of each window', async () => {
    const p = await runBasicPitch(new Float32Array(100000), fakeRunner([]));
    const kept = FRAMES_PER_WINDOW - 30;
    expect(p.onset[0]).toBe(15); // first kept frame of window 0
    expect(p.note[(kept - 1) * BINS]).toBe(0);
    expect(p.note[kept * BINS]).toBe(1); // next frame comes from window 1
    expect(p.onset[kept * BINS]).toBe(15);
  });

  it('handles audio shorter than one window', async () => {
    const p = await runBasicPitch(new Float32Array(5000), fakeRunner([]));
    expect(p.frames).toBe(Math.floor(5000 / 256));
  });
});

describe('extractNotes', () => {
  it('finds a sustained note with its pitch and length', () => {
    const p = empty(200);
    paint(p, 39, 20, 70);
    const notes = extractNotes(p);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.pitch).toBe(60);
    expect(notes[0]!.start).toBeCloseTo((20 * HOP_SAMPLES) / SAMPLE_RATE, 3);
    expect(notes[0]!.end - notes[0]!.start).toBeCloseTo((50 * HOP_SAMPLES) / SAMPLE_RATE, 1);
    expect(notes[0]!.velocity).toBeCloseTo(0.8, 2);
  });

  it('drops notes shorter than the minimum', () => {
    const p = empty(100);
    paint(p, 39, 10, 15);
    expect(extractNotes(p)).toEqual([]);
  });

  it('returns nothing for silence', () => {
    expect(extractNotes(empty(300))).toEqual([]);
  });
});

describe('toMelody', () => {
  it('keeps one note at a time, preferring the stronger one', () => {
    const melody = toMelody([
      { pitch: 60, start: 0, end: 1, velocity: 0.9 },
      { pitch: 64, start: 0.5, end: 1.5, velocity: 0.8 },
      { pitch: 30, start: 2, end: 3, velocity: 0.9 },
      { pitch: 67, start: 0.6, end: 0.7, velocity: 0.3 },
    ]);
    expect(melody.map((n) => n.pitch)).toEqual([60, 64]);
    expect(melody[0]!.end).toBe(0.5);
    for (let i = 1; i < melody.length; i++) expect(melody[i]!.start).toBeGreaterThanOrEqual(melody[i - 1]!.end);
  });
});

describe('runBasicPitch timing', () => {
  it('does not drift: a click one minute in lands on its own frame', async () => {
    const at = 60 * SAMPLE_RATE + 1234;
    const pcm = new Float32Array(at + 5 * SAMPLE_RATE);
    pcm[at] = 1;
    // Fake model: onset where the click falls inside this window.
    const runner: TensorRunner = {
      async run(feeds) {
        const input = Object.values(feeds)[0]!.data;
        const onset = new Float32Array(FRAMES_PER_WINDOW * BINS);
        const i = input.indexOf(1);
        if (i >= 0) onset[Math.round(i / HOP_SAMPLES) * BINS] = 1;
        return { [BASIC_PITCH.NOTE_OUTPUT]: new Float32Array(FRAMES_PER_WINDOW * BINS), [BASIC_PITCH.ONSET_OUTPUT]: onset };
      },
      release: async () => {},
    };
    const p = await runBasicPitch(pcm, runner);
    const frames: number[] = [];
    for (let f = 0; f < p.frames; f++) if (p.onset[f * BINS] === 1) frames.push(f);
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) expect(Math.abs(f - at / HOP_SAMPLES)).toBeLessThanOrEqual(1);
  });
});
