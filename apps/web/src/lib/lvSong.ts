import type { ChordSegment } from '@will-music/engine';

const RATE = 22050;
const CORE = 30 * RATE;
const CONTEXT = 5 * RATE;

/** Bounded inference, with context discarded at each boundary and absolute song timestamps retained. */
export const analyzeLvSong = async (
  pcm: Float32Array,
  analyze: (clip: Float32Array<ArrayBuffer>, detail: (label: string) => void) => Promise<ChordSegment[]>,
  progress: (done: number, total: number, detail?: string) => void = () => {},
): Promise<ChordSegment[]> => {
  if (!pcm.length) throw new Error('O áudio está vazio.');
  const result: ChordSegment[] = [];
  const total = Math.ceil(pcm.length / CORE);
  progress(0, total);
  for (let offset = 0, block = 0; offset < pcm.length; offset += CORE, block++) {
    const from = Math.max(0, offset - CONTEXT);
    const coreEnd = Math.min(pcm.length, offset + CORE);
    const to = Math.min(pcm.length, coreEnd + CONTEXT);
    const chords = await analyze(pcm.slice(from, to), (detail) => progress(block, total, detail));
    for (const chord of chords) {
      const start = Math.max(offset / RATE, from / RATE + chord.start);
      const end = Math.min(coreEnd / RATE, from / RATE + chord.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const previous = result.at(-1);
      if (previous?.raw === chord.raw && Math.abs(previous.end - start) < 1e-6) previous.end = end;
      else result.push({ ...chord, start, end });
    }
    progress(block + 1, total);
  }
  return result;
};
