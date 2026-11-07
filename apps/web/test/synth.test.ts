import { describe, expect, it } from 'vitest';
import { eventsInWindow, midiToHz, toSynthEvents } from '../src/lib/synth.ts';
import { sumTracks } from '../src/lib/exportMix.ts';

describe('score synth', () => {
  it('tunes A4 to 440 Hz', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBe(880);
  });

  it('merges notes and drum hits in time order', () => {
    const events = toSynthEvents({ notes: [{ pitch: 60, start: 1, end: 1.5 }], hits: [{ time: 0.5, kind: 'kick' }] });
    expect(events.map((e) => e.time)).toEqual([0.5, 1]);
    expect(events[0]!.drum).toBe('kick');
    expect(events[1]!.dur).toBe(0.5);
  });

  it('finds the events due in a window', () => {
    const events = [0, 1, 2, 3, 4].map((time) => ({ time, dur: 0.1 }));
    expect(eventsInWindow(events, 1, 3).map((e) => e.time)).toEqual([1, 2]);
    expect(eventsInWindow(events, 4.5, 9)).toEqual([]);
  });
});

describe('mix export', () => {
  it('adds the tracks with their volumes and keeps the peak under 0.99', () => {
    const a = { left: Float32Array.from([0.5, 0.2]), right: Float32Array.from([0.5, 0.2]), volume: 1 };
    const b = { left: Float32Array.from([0.4]), right: Float32Array.from([0.4]), volume: 0.5 };
    const quiet = sumTracks([a, b]);
    expect(Array.from(quiet.left)).toEqual([Math.fround(0.7), Math.fround(0.2)]);
    const loud = sumTracks([a, { ...a }]);
    expect(Math.max(...loud.left)).toBeCloseTo(0.99, 5);
  });
});
