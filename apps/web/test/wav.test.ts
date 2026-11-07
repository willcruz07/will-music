import { describe, expect, it } from 'vitest';
import { encodeWav16 } from '../src/lib/wav.ts';

describe('WAV encoding', () => {
  it('writes a valid 16-bit stereo 44.1 kHz header and clips', async () => {
    const planar = Float32Array.from([0, 1.5, -1.5, 0.5]); // L = [0, 1.5], R = [-1.5, 0.5]
    const blob = encodeWav16(planar, 2, 44100);
    const v = new DataView(await blob.arrayBuffer());
    const text = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8);
    expect(blob.size).toBe(44 + 8);
    expect([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true), v.getInt16(50, true)]).toEqual([0, -32767, 32767, 16384]);
  });
});
