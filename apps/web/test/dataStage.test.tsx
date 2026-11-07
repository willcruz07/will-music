import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { createSong, db, updateSong } from '../src/lib/db.ts';
import { memoryDir } from './memoryDir.ts';
import { displayName, restoreFiles, scanFileList, scanFolder, writeAllToFolder, writeSongToFolder } from '../src/lib/folder.ts';
import { exportSongs, importPackage, readPackage } from '../src/lib/package.ts';
import { keepOnlyChart, songStorage } from '../src/lib/storageManager.ts';
import { Library } from '../src/pages/Library.tsx';

const clear = () => Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear(), db.scores.clear(), db.stemSets.clear(), db.peaks.clear(), db.setlists.clear()]);
beforeEach(clear);

const scoreOf = (songId: string) => ({ songId, notes: [{ pitch: 64, start: 0, end: 0.5, velocity: 1 }], bpm: 100, source: 'mix' as const, model: 'x', createdAt: '' });

describe('packages keep scores and folders', () => {
  it('round-trips the score and the folder of a song', async () => {
    const song = await createManualSong('Hino 1', 'Coral');
    await updateSong(song.id, { folder: 'Culto' });
    await db.scores.put(scoreOf(song.id));
    const zip = await exportSongs([song.id], { includeAudio: false, kind: 'song' });
    await clear();
    await importPackage(await readPackage(zip), async () => 'replace');
    expect((await db.songs.get(song.id))!.folder).toBe('Culto');
    expect((await db.scores.get(song.id))!.notes).toHaveLength(1);
  });
});

describe('device folder', () => {
  it('writes the chart, the scores and a package for a song', async () => {
    const song = await createManualSong('Santo', 'Coral');
    await updateSong(song.id, { folder: 'Culto' });
    await db.scores.put(scoreOf(song.id));
    const root = memoryDir();
    await writeSongToFolder(root, song.id, { includeAudio: false });
    const tag = song.id.slice(0, 6);
    expect([...root.dirs.get('Cifras')!.dirs.get('Culto')!.files.keys()]).toEqual([`Santo - Coral [${tag}].cho`]);
    expect([...root.dirs.get('Partituras')!.files.keys()].sort()).toEqual([`Santo - Coral [${tag}] (guitarra).musicxml`, `Santo - Coral [${tag}] (melodia).musicxml`]);
    expect([...root.dirs.get('Pacotes')!.files.keys()]).toEqual([`Santo - Coral [${tag}].willmusic.zip`]);
  });

  it('saves everything plus a text-only backup, then restores it all into an empty app', async () => {
    const a = await createManualSong('Hino A', '');
    await createManualSong('Hino B', 'Banda');
    await db.setlists.put({ id: 'l1', name: 'Domingo', items: [{ songId: a.id }], createdAt: '', updatedAt: '' });
    const root = memoryDir();
    const progress: number[] = [];
    await writeAllToFolder(root, { includeAudio: false }, (done) => progress.push(done));
    expect(root.dirs.get('Backup')!.files.has('will-music-backup.willmusic.zip')).toBe(true);
    expect(progress.at(-1)).toBe(2);

    await clear();
    const found = await scanFolder(root);
    expect(found.filter((f) => f.kind === 'package').length).toBe(3);
    const result = await restoreFiles(found, async () => 'replace');
    expect(result.songs).toBe(2);
    expect((await db.songs.toArray()).map((s) => s.title).sort()).toEqual(['Hino A', 'Hino B']);
    expect((await db.setlists.toArray()).map((s) => s.name)).toContain('Domingo');
  });

  it('creates songs from loose ChordPro files, with the folder taken from the path', async () => {
    const files = [new File(['{title: Aleluia}\n{artist: Coral}\n[G]Aleluia'], 'Aleluia.cho')];
    Object.defineProperty(files[0]!, 'webkitRelativePath', { value: 'will-music/Cifras/Natal/Aleluia.cho' });
    const found = scanFileList(files);
    expect(found).toHaveLength(1);
    const result = await restoreFiles(found, async () => 'replace');
    expect(result.songs).toBe(1);
    const song = (await db.songs.toArray())[0]!;
    expect(song).toMatchObject({ title: 'Aleluia', artist: 'Coral', folder: 'Natal' });
    expect((await db.charts.where('songId').equals(song.id).first())!.chordPro).toContain('[G]Aleluia');
    // Restoring the same file again does not duplicate the song.
    await restoreFiles(found, async () => 'replace');
    expect(await db.songs.count()).toBe(1);
  });

  it('uses names that are safe on every system', () => {
    expect(displayName({ title: 'Ele é: o "Rei"?', artist: 'A/B' })).toBe('Ele é o Rei - A B');
  });
});

describe('storage manager', () => {
  it('lists sizes per song and can keep only the chart', async () => {
    const song = await createSong({ title: 'Com áudio', artist: '', durationSec: 10 }, new Blob(['x'.repeat(1000)], { type: 'audio/mpeg' }));
    await db.charts.add({ id: 'c', songId: song.id, chordPro: '[C]Oi', transpose: 0, fontSize: 18, origin: 'manual', createdAt: '', updatedAt: '' });
    await db.stemSets.put({ songId: song.id, mode: 'vocals', model: 'x', sampleRate: 44100, tracks: [{ name: 'lead', blob: new Blob(['y'.repeat(500)]) }], createdAt: '', selectedAt: '' });
    await db.scores.put(scoreOf(song.id));
    const [row] = await songStorage();
    expect(row).toMatchObject({ id: song.id, audio: 1000, stems: 500 });
    await keepOnlyChart(song.id);
    expect(await db.audio.get(song.id)).toBeUndefined();
    expect(await db.stemSets.where('songId').equals(song.id).count()).toBe(0);
    expect(await db.charts.where('songId').equals(song.id).count()).toBe(1);
    expect(await db.scores.get(song.id)).toBeTruthy();
  });
});

describe('library folders', () => {
  it('filters the library by folder', async () => {
    const a = await createManualSong('Hino do culto', '');
    await updateSong(a.id, { folder: 'Culto' });
    await createManualSong('Música solta', '');
    render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Música solta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Culto/ }));
    expect(screen.queryByText('Música solta')).toBeNull();
    expect(screen.getByText('Hino do culto')).toBeInTheDocument();
  });
});
