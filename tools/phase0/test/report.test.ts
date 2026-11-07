import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Reference, loadReferences } from '../src/references.ts';
import { type SongResult, renderReport } from '../src/report.ts';

const reference = (over: Partial<Reference> = {}): Reference => ({
  id: 'x', title: 'Música', artist: 'Artista', audio: 'a.mp3', key: { root: 'A', mode: 'major' },
  status: 'confirmed', sequence: ['A', 'E', 'F#m', 'D'], ...over,
});

const fakeResult = ({ recall, status = 'confirmed' }: { recall: number; status?: 'draft' | 'confirmed' }): SongResult => ({
  reference: reference({ status }),
  durationSec: 200,
  processingSec: 12,
  key: { root: 'A', mode: 'major', label: 'A major', index: 0, margin: 0.05 },
  keyMatch: 'exact',
  score: { lcs: 4, recall, precision: 0.8 },
  segments: [],
  simplified: ['A', 'E', 'F#m', 'D'],
});

describe('Phase 0 report', () => {
  it('renders the gate verdict from the mean recall', () => {
    const md = renderReport([fakeResult({ recall: 0.8 }), fakeResult({ recall: 0.7 })], '2026-11-06');
    expect(md).toContain('Cobertura média: 75%');
    expect(md).toContain('Seguir');
    expect(renderReport([fakeResult({ recall: 0.5 })], '2026-11-06')).toContain('Abaixo da meta');
  });

  it('marks draft references', () => {
    expect(renderReport([fakeResult({ recall: 0.9, status: 'draft' })], '2026-11-06')).toContain('rascunho');
  });
});

describe('references', () => {
  it('loads valid references and names the file of a bad chord', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'refs-'));
    await writeFile(join(dir, 'ok.json'), JSON.stringify(reference({ id: 'ok' })));
    expect((await loadReferences(dir)).map((r) => r.id)).toEqual(['ok']);
    await writeFile(join(dir, 'ruim.json'), JSON.stringify(reference({ id: 'ruim', sequence: ['A', 'H7'] })));
    await expect(loadReferences(dir)).rejects.toThrow(/ruim\.json.*H7/);
  });
});
