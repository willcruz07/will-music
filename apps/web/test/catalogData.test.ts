import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db.ts';
import { catalogContent, catalogLocalId, mapCatalogChart, saveCatalogChart } from '../src/lib/catalogData.ts';
import { parseChordPro } from '../src/lib/chart.ts';

beforeEach(async () => { await db.songs.clear(); await db.charts.clear(); });

describe('catalog adapter and independent offline saves', () => {
  it('ignores an invalid primary photo and accepts the alternative image field', () => {
    const item = mapCatalogChart('photo-validation', { title: 'Teste', artist: { name: 'Artista', photo: 'sem foto', image: 'https://example.com/valid.jpg' } })!;
    expect(item.artistRef?.photo).toBe('https://example.com/valid.jpg');
  });
  it('preserves slash chords and comments, and never invents a C key', () => {
    const item = mapCatalogChart('doc-1', { title: 'Canção', artist: { name: 'Artista' }, content: '{Intro}\n[C/E]Minha [G7(b9)]canção', style: 'mpb' })!;
    expect(item.key).toBeUndefined();
    expect(item.artist).toBe('Artista');
    const parsed = parseChordPro(item.content);
    expect(parsed.lines[0]).toEqual({ kind: 'comment', text: 'Intro' });
    expect(item.content).toContain('[C/E]Minha [G7(b9)]canção');
    expect(mapCatalogChart('missing', { content: 'abc' })).toBeNull();
    expect(mapCatalogChart('key', { title: 'Com tom', content: '{key: F#m}\n[F#m]Oi' })!.key).toBe('F#m');
    expect(catalogContent('[C]Oi {Refrão} [G]outra parte')).toContain('{comment: Refrão}');
  });

  it('uses the remote document identity, not a potentially duplicated title or slug', async () => {
    expect(await catalogLocalId('one')).not.toBe(await catalogLocalId('two'));
    expect(await catalogLocalId('one')).toBe(await catalogLocalId('one'));
    expect(await catalogLocalId('São João %')).toMatch(/^catalog-[a-f0-9]{64}$/);
  });

  it('saves a local chart without audio and preserves edits on a second import', async () => {
    const item = mapCatalogChart('test-offline', { title: 'Canção', artist: { name: 'Artista' }, content: '[C]Letra' })!;
    const song = await saveCatalogChart(item, 2, 22);
    const chart = await db.charts.where('songId').equals(song.id).first();
    expect(chart).toMatchObject({ transpose: 2, fontSize: 22, chordPro: '[C]Letra' });
    expect(song.catalogSource).toMatchObject({ collection: 'cifras', id: 'test-offline' });
    expect(await db.audio.get(song.id)).toBeUndefined();
    await db.charts.update(chart!.id, { chordPro: '[Dm]Minha edição', transpose: -1 });
    const again = await saveCatalogChart({ ...item, content: '[G]Versão remota nova' });
    expect(again.id).toBe(song.id);
    expect(await db.songs.count()).toBe(1);
    expect(await db.charts.get(chart!.id)).toMatchObject({ chordPro: '[Dm]Minha edição', transpose: -1 });
  });

  it('rolls back the song if storing its chart fails, and permits retry', async () => {
    const item = mapCatalogChart('rollback', { title: 'Canção', content: '[C]Oi' })!;
    const spy = vi.spyOn(db.charts, 'add').mockRejectedValueOnce(new Error('QuotaExceededError'));
    await expect(saveCatalogChart(item)).rejects.toThrow(/armazenamento da cifra/);
    spy.mockRestore();
    expect(await db.songs.count()).toBe(0);
    await saveCatalogChart(item);
    expect(await db.songs.count()).toBe(1);
    expect(await db.charts.count()).toBe(1);
  });

  it('deduplicates concurrent saves in one transaction and rejects blank content', async () => {
    const item = mapCatalogChart('concurrent', { title: 'Canção', content: '[C]Oi' })!;
    const results = await Promise.all([saveCatalogChart(item), saveCatalogChart(item)]);
    expect(results[0]!.id).toBe(results[1]!.id);
    expect(await db.songs.count()).toBe(1);
    expect(await db.charts.count()).toBe(1);
    await expect(saveCatalogChart({ ...item, id: 'blank', content: ' ' })).rejects.toThrow(/conteúdo/);
  });
});
