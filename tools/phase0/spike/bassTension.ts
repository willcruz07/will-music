// SPIKE (descartável): estimar baixo invertido e tensões a partir do CQT, sem modelo novo.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { analyzeChords, chordMiniGraph, computeLogCqt, prepareAnalysisAudio, verifyCqtPlan } from '@will-music/engine';
import { decodeAudio } from '../src/ffmpeg.ts';
import { ensureModel } from '../src/models.ts';
import { createOrtRunner } from '../src/ortRunner.ts';
import { loadReferences } from '../src/references.ts';

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TONES: Record<string, number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], minmaj7: [0, 3, 7, 11],
  min6: [0, 3, 7, 9], maj6: [0, 4, 7, 9], dim: [0, 3, 6], dim7: [0, 3, 6, 9], hdim7: [0, 3, 6, 10], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
};
const TENSIONS: [number, string][] = [[2, '9'], [5, '11'], [9, '13']];

const chroma = (mag: Float64Array, from: number, to: number): Float64Array => {
  const out = new Float64Array(12);
  for (let b = from; b < to; b++) out[Math.round(b / 2) % 12]! += mag[b]!;
  return out;
};

const main = async () => {
  const plan = await verifyCqtPlan(new Uint8Array(await readFile(await ensureModel('cqtPlan'))));
  const runner = await createOrtRunner(await ensureModel('chordnet'));
  const only = process.argv[2];
  for (const ref of await loadReferences()) {
    if (only && ref.id !== only) continue;
    const { sampleRate, channels } = await decodeAudio(join(process.env.WILL_MUSIC_AUDIO_DIR ?? join(homedir(), 'Music'), ref.audio));
    const pcm = prepareAnalysisAudio(channels, sampleRate);
    const cqt = computeLogCqt(pcm, plan);
    const segs = await analyzeChords(pcm, plan, runner);
    let slash = 0, tension = 0, total = 0;
    const shown: string[] = [];
    for (const s of segs) {
      if (s.end - s.start < 0.75 || s.raw === 'N' || s.raw === 'X') continue;
      const [rootName, q = 'maj'] = s.raw.split(':') as [string, string?];
      const root = ROOTS.indexOf(rootName);
      const tones = (TONES[q] ?? [0, 4, 7]).map((t) => (root + t) % 12);
      const f0 = Math.floor(s.start / chordMiniGraph.frameDuration), f1 = Math.min(cqt.frameCount, Math.ceil(s.end / chordMiniGraph.frameDuration));
      const mag = new Float64Array(144);
      for (let f = f0; f < f1; f++) for (let b = 0; b < 144; b++) mag[b]! += Math.exp(cqt.data[f * 144 + b]!);
      // baixo: C1..B2 (bins 0..47)
      const bass = chroma(mag, 0, 48);
      const order = [...bass.keys()].sort((a, b) => bass[b]! - bass[a]!);
      const bassPc = order[0]!;
      const dominant = bass[order[0]!]! >= 1.3 * bass[order[1]!]!;
      let label = s.label;
      if (dominant && bassPc !== root && tones.includes(bassPc)) { label += `/${ROOTS[bassPc]}`; slash++; }
      // tensões: C3..B5 (bins 48..119)
      const mid = chroma(mag, 48, 120);
      const toneLevel = tones.reduce((a, t) => a + mid[t]!, 0) / tones.length;
      const found = TENSIONS.filter(([iv]) => { const pc = (root + iv) % 12; return !tones.includes(pc) && mid[pc]! >= 0.6 * toneLevel; }).map(([, n]) => n);
      if (found.length) { label = label.replace(/(\/.*)?$/, (m) => `(${found.join(',')})${m}`); tension++; }
      total++;
      if (shown.length < 28) shown.push(label);
    }
    console.log(`\n### ${ref.title}`);
    console.log(`segmentos: ${total} | com baixo invertido: ${slash} (${Math.round((100 * slash) / total)}%) | com tensão: ${tension} (${Math.round((100 * tension) / total)}%)`);
    console.log(shown.join('  '));
  }
  await runner.release();
};
main();
