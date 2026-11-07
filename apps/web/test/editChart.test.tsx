import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createManualSong, saveEditedChart } from '../src/lib/chartEdit.ts';
import { createSong, db } from '../src/lib/db.ts';
import { EditChart } from '../src/pages/EditChart.tsx';

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
});

describe('chart editor', () => {
  it('saves an edited chart, marks it edited and keeps line times', async () => {
    const song = await createSong({ title: 'T', artist: 'A', durationSec: 10 }, new Blob());
    await db.charts.add({ id: 'c', songId: song.id, chordPro: '[G]um\ndois', lineTimes: [1, 5], transpose: 0, fontSize: 18, origin: 'generated', createdAt: '', updatedAt: '' });
    await saveEditedChart(song.id, '[G]um\n[C]dois\ntrês');
    const chart = await db.charts.get('c');
    expect(chart).toMatchObject({ chordPro: '[G]um\n[C]dois\ntrês', origin: 'edited', lineTimes: [1, 5, null] });
  });

  it('edits in the page and returns to the song on save', async () => {
    const song = await createManualSong('Minha cifra', '');
    render(
      <MemoryRouter initialEntries={[`/musica/${song.id}/editar`]}>
        <Routes>
          <Route path="/musica/:id/editar" element={<EditChart />} />
          <Route path="/musica/:id" element={<p>tela da música</p>} />
        </Routes>
      </MemoryRouter>,
    );
    const box = await screen.findByLabelText('Cifra em ChordPro');
    await userEvent.type(box, '[[G]Santo');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('tela da música')).toBeInTheDocument();
    const chart = await db.charts.where('songId').equals(song.id).first();
    expect(chart!.chordPro).toContain('[G]Santo');
    expect(chart!.origin).toBe('edited');
  });

  it('creates a song without audio with an empty manual chart', async () => {
    const song = await createManualSong('Sem áudio', 'Eu');
    expect(song.analysisStatus).toBe('done');
    expect(await db.audio.get(song.id)).toBeUndefined();
    expect((await db.charts.where('songId').equals(song.id).first())!.origin).toBe('manual');
  });
});

describe('review fixes: editor', () => {
  it('keeps line timing of charts saved before lineTimes existed', async () => {
    const song = await createSong({ title: 'T', artist: 'A', durationSec: 10 }, new Blob());
    await db.analyses.add({ id: 'a', songId: song.id, schemaVersion: 1, models: {}, key: { root: 'G', mode: 'major', label: 'G major', index: 10, margin: 0 }, chords: [], lyrics: { source: 'lrclib', lines: [{ start: 3, text: 'um' }, { start: 8, text: 'dois' }] }, createdAt: '', updatedAt: '' });
    await db.charts.add({ id: 'c', songId: song.id, chordPro: 'um\ndois', transpose: 0, fontSize: 18, origin: 'generated', createdAt: '', updatedAt: '' });
    await saveEditedChart(song.id, '[G]um\ndois');
    expect((await db.charts.get('c'))!.lineTimes).toEqual([3, 8]);
  });
});
