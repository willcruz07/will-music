import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSong, db } from '../src/lib/db.ts';
import { exportSongs, importPackage, readPackage, safeFileName } from '../src/lib/package.ts';
import { createSetlist, updateSetlist } from '../src/lib/setlists.ts';

const clear = () => Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear(), db.setlists.clear()]);
beforeEach(clear);

const seed = async () => {
  const song = await createSong({ title: 'Ninguém Explica Deus', artist: 'Preto no Branco', durationSec: 300 }, new Blob(['audio-bytes-123'], { type: 'audio/mpeg' }));
  await db.charts.add({ id: 'c1', songId: song.id, chordPro: '[G]Ninguém', transpose: 2, fontSize: 20, origin: 'edited', lineTimes: [1.5], createdAt: 'x', updatedAt: 'x' });
  await db.analyses.add({ id: 'a1', songId: song.id, schemaVersion: 1, models: {}, key: { root: 'G', mode: 'major', label: 'G major', index: 10, margin: 0.1 }, chords: [{ start: 0, end: 4, raw: 'G', label: 'G' }], createdAt: 'x', updatedAt: 'x' });
  return song;
};

describe('packages', () => {
  it('round-trips a song with chart, analysis and audio', async () => {
    const song = await seed();
    const zip = await exportSongs([song.id], { includeAudio: true, kind: 'song' });
    await clear();
    const result = await importPackage(await readPackage(zip), async () => 'replace');
    expect(result.songs).toBe(1);
    const back = await db.songs.get(song.id);
    expect(back!.title).toBe('Ninguém Explica Deus');
    expect((await db.charts.where('songId').equals(song.id).first())).toMatchObject({ chordPro: '[G]Ninguém', transpose: 2, origin: 'edited', lineTimes: [1.5] });
    expect((await db.analyses.where('songId').equals(song.id).first())!.chords).toHaveLength(1);
    expect((await db.audio.get(song.id))!.blob.size).toBe(15);
  });

  it('replaces or keeps both when the song exists, remapping the setlist', async () => {
    const song = await seed();
    const list = await createSetlist('Domingo');
    await updateSetlist(list.id, { items: [{ songId: song.id, targetKey: 'A' }] });
    const zip = await exportSongs([song.id], { includeAudio: false, kind: 'setlist', setlist: (await db.setlists.get(list.id))! });

    await importPackage(await readPackage(zip), async () => 'replace');
    expect(await db.songs.count()).toBe(1);

    const imported = await importPackage(await readPackage(zip), async () => 'keep-both');
    expect(await db.songs.count()).toBe(2);
    const newSongId = imported.setlist!.items[0]!.songId;
    expect(newSongId).not.toBe(song.id);
    expect(await db.songs.get(newSongId)).toBeTruthy();
    expect(imported.setlist!.items[0]!.targetKey).toBe('A');
    expect(imported.setlist!.id).not.toBe(list.id);
  });

  it('rejects foreign or future packages without writing', async () => {
    const foreign = new Blob([zipSync({ 'x.txt': strToU8('oi') })]);
    await expect(readPackage(foreign)).rejects.toThrow('Este arquivo não é um pacote do will-music.');
    const future = new Blob([zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'will-music', version: 2, kind: 'song' })) })]);
    await expect(readPackage(future)).rejects.toThrow(/versão mais nova/);
    await expect(readPackage(new Blob(['não é zip']))).rejects.toThrow('Este arquivo não é um pacote do will-music.');
    expect(await db.songs.count()).toBe(0);
  });

  it('makes safe file names', () => {
    expect(safeFileName('Ninguém Explica Deus: Ao Vivo?')).toBe('ninguem-explica-deus-ao-vivo');
  });
});

describe('review fixes: packages', () => {
  it('rejects corrupted contents with the friendly message', async () => {
    const bad = (files: Record<string, string>) => new Blob([zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))]);
    const manifest = (extra: object) => JSON.stringify({ format: 'will-music', kind: 'song', songIds: ['s'], ...extra });
    await expect(readPackage(bad({ 'manifest.json': manifest({}) }))).rejects.toThrow('Este arquivo não é um pacote do will-music.');
    await expect(readPackage(bad({ 'manifest.json': manifest({ version: 1, songIds: 'x' }) }))).rejects.toThrow('Este arquivo não é um pacote do will-music.');
    await expect(readPackage(bad({ 'manifest.json': manifest({ version: 1 }), 'songs/s/song.json': '{quebrado' }))).rejects.toThrow('Este arquivo não é um pacote do will-music.');
    await expect(readPackage(bad({ 'manifest.json': manifest({ version: 1 }), 'songs/s/song.json': '{"title":"sem id"}' }))).rejects.toThrow('Este arquivo não é um pacote do will-music.');
  });

  it('writes nothing when a write fails, keeping the song it would replace', async () => {
    const song = await seed();
    const zip = await exportSongs([song.id], { includeAudio: true, kind: 'song' });
    const contents = await readPackage(zip);
    const original = db.audio.put.bind(db.audio);
    db.audio.put = (() => Promise.reject(new Error("quota"))) as unknown as typeof db.audio.put;
    await expect(importPackage(contents, async () => 'replace')).rejects.toThrow();
    db.audio.put = original;
    expect(await db.songs.get(song.id)).toBeTruthy();
    expect((await db.charts.where('songId').equals(song.id).first())!.chordPro).toBe('[G]Ninguém');
  });

  it('backs up every setlist and asks about conflicts once', async () => {
    const a = await seed();
    const b = await createSong({ title: 'Outra', artist: '', durationSec: 1 }, new Blob());
    const l1 = await createSetlist('Domingo');
    const l2 = await createSetlist('Quarta');
    await updateSetlist(l1.id, { items: [{ songId: a.id }] });
    await updateSetlist(l2.id, { items: [{ songId: b.id }] });
    const zip = await exportSongs([a.id, b.id], { includeAudio: false, kind: 'backup', setlists: await db.setlists.toArray() });
    let asked = 0;
    const result = await importPackage(await readPackage(zip), async (conflicts) => {
      asked += 1;
      expect(conflicts).toHaveLength(2);
      return 'keep-both';
    });
    expect(asked).toBe(1);
    expect(result.setlists.map((s) => s.name).sort()).toEqual(['Domingo', 'Quarta']);
    expect(await db.setlists.count()).toBe(4);
  });
});

describe('review fixes: package replace and stems', () => {
  it('drops old stems when a song is replaced', async () => {
    const song = await seed();
    const zip = await exportSongs([song.id], { includeAudio: false, kind: 'song' });
    await db.stems.put({ songId: song.id, model: 'x', sampleRate: 44100, tracks: [], createdAt: '' });
    await importPackage(await readPackage(zip), async () => 'replace');
    expect(await db.stems.get(song.id)).toBeUndefined();
  });
});
