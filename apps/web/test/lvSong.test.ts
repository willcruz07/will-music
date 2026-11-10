import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { MODELS } from '@will-music/engine';
import { analyzeLvSong } from '../src/lib/lvSong.ts';
import { CHORD_MODELS } from '../src/lib/models.ts';
import { buildChart } from '../src/lib/chart.ts';

const RATE = 22050;
describe('LV-Chordia standard song integration', () => {
  it('reports work inside a block before it is complete', async () => {
    const events: unknown[] = [];
    await analyzeLvSong(new Float32Array(RATE), async (_clip, detail) => {
      detail('Executando rede 2 de 5');
      return [];
    }, (done, total, detail) => events.push([done, total, detail]));
    expect(events).toEqual([[0, 1, undefined], [0, 1, 'Executando rede 2 de 5'], [1, 1, undefined]]);
  });

  it('keeps bounded contextual inputs and merges identical labels at absolute boundaries', async () => {
    const lengths: number[] = [];
    const progress: number[] = [];
    const result = await analyzeLvSong(new Float32Array(65 * RATE), async (clip) => {
      lengths.push(clip.length / RATE);
      return [{ start: 0, end: clip.length / RATE + 0.02, raw: 'A:maj/5', label: 'A/E' }];
    }, (done) => progress.push(done));
    expect(lengths).toEqual([35, 40, 10]);
    expect(progress).toEqual([0, 1, 2, 3]);
    expect(result).toEqual([{ start: 0, end: 65, raw: 'A:maj/5', label: 'A/E' }]);
  });

  it('discards context predictions and converts local timestamps without duplicating transitions', async () => {
    let block = 0;
    const result = await analyzeLvSong(new Float32Array(61 * RATE), async (clip) => {
      block++;
      return block === 1
        ? [{ start: 0, end: 35, raw: 'C:maj', label: 'C' }]
        : [{ start: 0, end: 5, raw: 'C:maj', label: 'C' }, { start: 5, end: clip.length / RATE, raw: 'G:7', label: 'G7' }];
    });
    expect(result).toEqual([{ start: 0, end: 30, raw: 'C:maj', label: 'C' }, { start: 30, end: 61, raw: 'G:7', label: 'G7' }]);
  });

  it('clamps a partial final frame to the exact duration and rejects empty audio', async () => {
    expect(await analyzeLvSong(new Float32Array(RATE + 1), async () => [{ start: 0, end: 2, raw: 'N', label: 'N.C.' }]))
      .toEqual([{ start: 0, end: (RATE + 1) / RATE, raw: 'N', label: 'N.C.' }]);
    await expect(analyzeLvSong(new Float32Array(), async () => [])).rejects.toThrow('vazio');
  });

  it('keeps extended/inverted chord labels attached to the existing lyric timeline', () => {
    const chart = buildChart({ title: 'Teste', artist: '', key: { root: 'A', mode: 'major', label: 'A major', index: 0, margin: 1 },
      chords: [{ start: 10, end: 12, raw: 'A:maj/5', label: 'A/E' }, { start: 12, end: 14, raw: 'B:hdim7', label: 'Bm7(b5)' }],
      lines: [{ start: 10, text: 'Uma letra para estudar' }],
    });
    expect(chart).toContain('[A/E]');
    expect(chart).toContain('[Bm7(b5)]');
    expect(chart).toContain('Uma');
  });

  it('ships pinned assets and replaces the old MP3 download set while retaining SKey', () => {
    expect(CHORD_MODELS).not.toContain('chordnet');
    expect(CHORD_MODELS).not.toContain('cqtPlan');
    expect(CHORD_MODELS).toContain('skey');
    for (const id of CHORD_MODELS.filter((id) => id !== 'skey')) {
      const asset = MODELS[id];
      const bytes = readFileSync(`${process.cwd()}/public${asset.url}`);
      expect(bytes.length).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
    const plans = unzipSync(readFileSync(`${process.cwd()}/public/models/lv-chordia-v1/plans.zip`), { filter: (entry) => entry.name === 'cqt-50.json' });
    expect(Object.keys(plans)).toEqual(['cqt-50.json']);
    expect(JSON.parse(new TextDecoder().decode(plans['cqt-50.json']!)).groups.length).toBeGreaterThan(0);
  });
});
