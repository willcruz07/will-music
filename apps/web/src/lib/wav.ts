/** Planar float audio → 16-bit PCM WAV (clipped to ±1). */
export const encodeWav16Buffer = (planar: Float32Array, channels: number, sampleRate: number): ArrayBuffer => {
  const samples = planar.length / channels;
  const dataBytes = samples * channels * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buffer);
  const text = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < channels; c++) {
      const x = Math.max(-1, Math.min(1, planar[c * samples + i]!));
      v.setInt16(o, Math.round(x * 32767), true);
      o += 2;
    }
  }
  return buffer;
};

export const encodeWav16 = (planar: Float32Array, channels: number, sampleRate: number): Blob =>
  new Blob([encodeWav16Buffer(planar, channels, sampleRate)], { type: 'audio/wav' });
