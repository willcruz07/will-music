import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  analyzeChords,
  analyzeKey,
  compareKeys,
  lcsScore,
  parseReferenceChord,
  prepareAnalysisAudio,
  simplifySegments,
  toDisplayLabel,
  verifyCqtPlan,
  type MajMin,
} from '@will-music/engine';
import { decodeAudio } from './ffmpeg.ts';
import { ensureModel } from './models.ts';
import { createOrtRunner } from './ortRunner.ts';
import { DEFAULT_REFERENCES_DIR, loadReferences } from './references.ts';
import { type SongResult, renderReport } from './report.ts';

const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const majMinLabel = (c: MajMin): string => `${ROOTS[c.pc]}${c.quality === 'min' ? 'm' : ''}`;

const main = async (): Promise<void> => {
  const { values } = parseArgs({ options: { 'allow-draft': { type: 'boolean', default: false }, only: { type: 'string' } } });
  const audioDir = process.env.WILL_MUSIC_AUDIO_DIR ?? join(homedir(), 'Music');
  const docsDir = join(DEFAULT_REFERENCES_DIR, '..');
  let references = await loadReferences();
  if (values.only) references = references.filter((r) => r.id === values.only);
  const drafts = references.filter((r) => r.status === 'draft');
  if (drafts.length && !values['allow-draft']) {
    throw new Error(`Referências em rascunho: ${drafts.map((r) => r.id).join(', ')}. Confirme-as ou use --allow-draft.`);
  }

  const plan = await verifyCqtPlan(new Uint8Array(await readFile(await ensureModel('cqtPlan'))));
  const chordRunner = await createOrtRunner(await ensureModel('chordnet'));
  const keyRunner = await createOrtRunner(await ensureModel('skey'));
  const results: SongResult[] = [];
  try {
    for (const reference of references) {
      const started = performance.now();
      console.log(`→ ${reference.title}`);
      const { sampleRate, channels } = await decodeAudio(join(audioDir, reference.audio));
      const pcm = prepareAnalysisAudio(channels, sampleRate);
      const segments = await analyzeChords(pcm, plan, chordRunner);
      const key = await analyzeKey(pcm, keyRunner);
      const predicted = simplifySegments(segments);
      const expected = reference.sequence.map(parseReferenceChord).filter((c): c is MajMin => c !== null);
      const result: SongResult = {
        reference,
        durationSec: pcm.length / 22050,
        processingSec: (performance.now() - started) / 1000,
        key,
        keyMatch: compareKeys(reference.key, key),
        score: lcsScore(expected, predicted),
        segments,
        simplified: predicted.map(majMinLabel),
      };
      results.push(result);
      console.log(`  tom ${key.label} (${result.keyMatch}), cobertura ${Math.round(result.score.recall * 100)}%`);
      await mkdir(join(docsDir, 'resultados'), { recursive: true });
      await writeFile(
        join(docsDir, 'resultados', `${reference.id}.json`),
        `${JSON.stringify({ key, score: result.score, simplified: result.simplified, segments: segments.map((s) => ({ ...s, label: toDisplayLabel(s.raw) })) }, null, 2)}\n`,
      );
    }
  } finally {
    await chordRunner.release();
    await keyRunner.release();
  }
  await writeFile(join(docsDir, 'relatorio.md'), renderReport(results, new Date().toISOString().slice(0, 10)));
  console.log(`Relatório: ${join(docsDir, 'relatorio.md')}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
