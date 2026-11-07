import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { createSong, db, deleteSong, updateSong } from '../src/lib/db.ts';
import { createFolderSync, restoreFiles, scanFolder, writeAllToFolder, writeSongToFolder } from '../src/lib/folder.ts';
import { exportSongs, importPackage, readPackage } from '../src/lib/package.ts';
import { keepOnlyChart } from '../src/lib/storageManager.ts';
import { allFiles, memoryDir } from './memoryDir.ts';

const clear = () => Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear(), db.scores.clear(), db.stemSets.clear(), db.peaks.clear(), db.setlists.clear(), db.settings.clear()]);
beforeEach(clear);

const withAudio = async (title: string) => {
  const song = await createSong({ title, artist: '', durationSec: 10 }, new Blob(['audio-bytes'], { type: 'audio/mpeg' }));
  await db.charts.add({ id: crypto.randomUUID(), songId: song.id, chordPro: `{title: ${title}}\n[C]Oi`, transpose: 0, fontSize: 18, origin: 'manual', createdAt: '', updatedAt: '' });
  return song;
};

const packageFile = async (root: ReturnType<typeof memoryDir>) => [...root.dirs.get('Pacotes')!.files.values()][0]!;

describe('review fixes: folder files', () => {
  it('gives two songs with the same name their own files', async () => {
    await createManualSong('Aleluia', '');
    await createManualSong('Aleluia', '');
    const root = memoryDir();
    await writeAllToFolder(root, { includeAudio: false }, () => {});
    expect(root.dirs.get('Pacotes')!.files.size).toBe(2);
    expect(root.dirs.get('Cifras')!.files.size).toBe(2);
  });

  it('never replaces a package holding the audio with one without it', async () => {
    const song = await withAudio('Hino');
    const root = memoryDir();
    await writeSongToFolder(root, song.id, { includeAudio: true });
    await keepOnlyChart(song.id);
    await updateSong(song.id, { tempo: 90 });
    await writeSongToFolder(root, song.id, { includeAudio: true });
    const contents = await readPackage(await packageFile(root));
    expect(contents.songs[0]!.audio).toBeDefined();
    expect(contents.songs[0]!.song.tempo).toBe(90);
  });

  it('moves the old files when a song is renamed', async () => {
    const song = await createManualSong('Nome antigo', '');
    const root = memoryDir();
    await writeSongToFolder(root, song.id, { includeAudio: false });
    await updateSong(song.id, { title: 'Nome novo' });
    await writeSongToFolder(root, song.id, { includeAudio: false });
    const files = allFiles(root);
    expect(files.some((f) => f.includes('Nome antigo'))).toBe(false);
    expect(files.some((f) => f.includes('Nome novo'))).toBe(true);
  });
});

describe('review fixes: restoring a folder', () => {
  it('restores what the app wrote without duplicating songs or lists, and without asking', async () => {
    const a = await createManualSong('Hino A', '');
    await createManualSong('Hino B', 'Banda');
    await db.setlists.put({ id: 'l1', name: 'Domingo', items: [{ songId: a.id }], createdAt: '', updatedAt: '' });
    const root = memoryDir();
    await writeAllToFolder(root, { includeAudio: false }, () => {});
    await clear();
    const resolve = vi.fn(async () => 'keep-both' as const);
    const result = await restoreFiles(await scanFolder(root), resolve);
    expect(resolve).not.toHaveBeenCalled();
    expect(await db.songs.count()).toBe(2);
    expect(await db.setlists.count()).toBe(1);
    expect(result.songs).toBe(2);
  });

  it('restoring again replaces in place, keeps separated tracks and does not add the lists twice', async () => {
    const a = await createManualSong('Hino A', '');
    await db.setlists.put({ id: 'l1', name: 'Domingo', items: [{ songId: a.id }], createdAt: '', updatedAt: '' });
    const root = memoryDir();
    await writeAllToFolder(root, { includeAudio: false }, () => {});
    await db.stemSets.put({ songId: a.id, mode: 'vocals', model: 'x', sampleRate: 44100, tracks: [], createdAt: '', selectedAt: '' });
    await restoreFiles(await scanFolder(root), async () => 'replace');
    expect(await db.songs.count()).toBe(1);
    expect(await db.setlists.count()).toBe(1);
    expect(await db.stemSets.where('songId').equals(a.id).count()).toBe(1);
  });

  it('replacing from a package without audio keeps the audio already on the device', async () => {
    const song = await withAudio('Com áudio');
    const zip = await exportSongs([song.id], { includeAudio: false, kind: 'song' });
    await importPackage(await readPackage(zip), async () => 'replace');
    expect(await db.audio.get(song.id)).toBeDefined();
  });
});

describe('review fixes: automatic saving', () => {
  it('writes one song at a time, remembers changes made without permission and saves them once allowed', async () => {
    const root = memoryDir();
    root.permission = 'prompt';
    const sync = createFolderSync({ delayMs: 0, getDir: async () => root });
    const song = await createManualSong('Pendente', '');
    await sync.request(song.id);
    await sync.idle();
    expect(allFiles(root)).toEqual([]);
    expect(await sync.pending()).toEqual([song.id]);
    root.permission = 'granted';
    await sync.flush();
    expect(allFiles(root).some((f) => f.includes('Pendente'))).toBe(true);
    expect(await sync.pending()).toEqual([]);
  });

  it('moves a deleted song into the trash folder instead of leaving it to come back', async () => {
    const root = memoryDir();
    const sync = createFolderSync({ delayMs: 0, getDir: async () => root });
    const song = await createManualSong('Apagada', '');
    await writeSongToFolder(root, song.id, { includeAudio: false });
    await sync.trash(song.id, 'Apagada');
    await deleteSong(song.id);
    const files = allFiles(root);
    expect(files.filter((f) => f.includes('Apagada')).every((f) => f.startsWith('Lixeira/'))).toBe(true);
    expect(files.some((f) => f.startsWith('Lixeira/'))).toBe(true);
  });
});

describe('review fixes: microphone', () => {
  it('closes a microphone that finishes opening after the page was left', async () => {
    let finish!: (m: unknown) => void;
    const close = vi.fn();
    vi.doMock('../src/lib/mic.ts', () => ({ openMic: () => new Promise((r) => (finish = r)), tapSamples: async () => () => {} }));
    const { MicPage } = await import('../src/pages/MicPage.tsx');
    const { getByRole, unmount } = render(<MicPage />);
    act(() => getByRole('button', { name: /Ligar microfone/ }).click());
    unmount();
    await act(async () => finish({ close, context: {}, source: {}, stream: {} }));
    expect(close).toHaveBeenCalled();
    vi.doUnmock('../src/lib/mic.ts');
  });
});
