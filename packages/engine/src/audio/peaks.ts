/** Peak absolute amplitude per column, for drawing a waveform. */
export const computePeaks = (audio: Float32Array, columns: number): Float32Array => {
  const out = new Float32Array(columns);
  if (!audio.length) return out;
  const per = audio.length / columns;
  for (let c = 0; c < columns; c++) {
    const from = Math.floor(c * per);
    const to = Math.min(audio.length, Math.max(from + 1, Math.floor((c + 1) * per)));
    let peak = 0;
    for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(audio[i]!));
    out[c] = peak;
  }
  return out;
};
