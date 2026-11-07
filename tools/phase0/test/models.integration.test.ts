import { readFile } from 'node:fs/promises';
import { type CqtPlan, type TensorRunner, analyzeChords, analyzeKey, verifyCqtPlan } from '@will-music/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureModel } from '../src/models.ts';
import { createOrtRunner } from '../src/ortRunner.ts';
import { chordTone, progression, shareOfTime } from './synth.ts';

let plan: CqtPlan;
let chordRunner: TensorRunner;
let keyRunner: TensorRunner;

beforeAll(async () => {
  plan = await verifyCqtPlan(new Uint8Array(await readFile(await ensureModel('cqtPlan'))));
  chordRunner = await createOrtRunner(await ensureModel('chordnet'));
  keyRunner = await createOrtRunner(await ensureModel('skey'));
}, 300000);

afterAll(async () => {
  await chordRunner?.release();
  await keyRunner?.release();
});

describe('real models on synthetic audio', () => {
  it('labels a synthetic C major triad as C', async () => {
    const segs = await analyzeChords(chordTone([130.81, 261.63, 329.63, 392.0], 8), plan, chordRunner);
    console.log('C major ->', segs.map((s) => `${s.label}@${s.start}`).join(' '));
    expect(shareOfTime(segs, { pc: 0, quality: 'maj' })).toBeGreaterThan(0.5);
  }, 120000);

  it('labels a synthetic A minor triad as A minor', async () => {
    const segs = await analyzeChords(chordTone([110.0, 220.0, 261.63, 329.63], 8), plan, chordRunner);
    console.log('A minor ->', segs.map((s) => `${s.label}@${s.start}`).join(' '));
    expect(shareOfTime(segs, { pc: 9, quality: 'min' })).toBeGreaterThan(0.5);
  }, 120000);

  it('finds C major on a C-F-G-C progression', async () => {
    const pcm = progression(
      [[130.81, 261.63, 329.63, 392.0], [174.61, 349.23, 440.0, 523.25], [196.0, 392.0, 493.88, 587.33], [130.81, 261.63, 329.63, 392.0]],
      2,
      3,
    );
    const key = await analyzeKey(pcm, keyRunner);
    console.log('key ->', key);
    expect(key.label).toBe('C major');
  }, 120000);
});
