import { describe, expect, it } from 'vitest';
import { detectPitch, noteOf, voiceType } from '../src/audio/pitch.ts';

const tone = (hz: number, rate: number, n: number, harmonics = [1]) =>
  Float32Array.from({ length: n }, (_, i) => harmonics.reduce((s, a, k) => s + a * Math.sin((2 * Math.PI * hz * (k + 1) * i) / rate), 0) * 0.3);

describe('detectPitch', () => {
  it('finds A4 in a pure tone', () => {
    const p = detectPitch(tone(440, 48000, 2048), 48000)!;
    expect(p.hz).toBeGreaterThan(439);
    expect(p.hz).toBeLessThan(441);
    expect(p.clarity).toBeGreaterThan(0.9);
  });

  it('finds the low E of a guitar despite strong harmonics', () => {
    const p = detectPitch(tone(82.41, 48000, 4096, [0.6, 1, 0.8, 0.5]), 48000)!;
    expect(Math.abs(p.hz - 82.41)).toBeLessThan(0.5);
  });

  it('returns null for silence and for noise', () => {
    expect(detectPitch(new Float32Array(2048), 48000)).toBeNull();
    let s = 7;
    const noise = Float32Array.from({ length: 2048 }, () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.5);
    expect(detectPitch(noise, 48000)).toBeNull();
  });
});

describe('noteOf', () => {
  it('names the note and the cents off', () => {
    expect(noteOf(440)).toMatchObject({ midi: 69, name: 'A', octave: 4, cents: 0, solfege: 'Lá' });
    expect(noteOf(445).cents).toBe(20);
    expect(noteOf(261.63)).toMatchObject({ name: 'C', octave: 4, solfege: 'Dó' });
    expect(noteOf(432, 432)).toMatchObject({ name: 'A', cents: 0 });
  });
});

describe('voiceType', () => {
  const range = (lo: number, hi: number) => Array.from({ length: 40 }, (_, i) => lo + ((hi - lo) * i) / 39);
  it('suggests a voice type from the sung range', () => {
    expect(voiceType(range(48, 69))!.type).toBe('tenor');
    expect(voiceType(range(41, 62))!.type).toBe('baixo');
    expect(voiceType(range(60, 81))!.type).toBe('soprano');
    expect(voiceType(range(54, 74))!.type).toBe('contralto');
  });

  it('needs enough notes', () => {
    expect(voiceType([60, 62])).toBeNull();
  });
});
