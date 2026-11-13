import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSong, db, updateSong } from '../src/lib/db.ts';
import { createSetlist, keyOptions } from '../src/lib/setlists.ts';
import { SetlistEdit } from '../src/pages/SetlistEdit.tsx';
import { choose } from './choose.ts';
import { createManualSong, saveEditedChart } from '../src/lib/chartEdit.ts';

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear(), db.setlists.clear()]);
});

describe('key options', () => {
  it('lists the 12 keys of the same mode starting at the song key', () => {
    const g = keyOptions('G');
    expect(g).toHaveLength(12);
    expect(g[0]).toBe('G');
    expect(g).toContain('Bb');
    expect(g).toContain('F#');
    expect(keyOptions('Em').every((k) => k.endsWith('m'))).toBe(true);
  });
});

describe('setlist editor', () => {
  it('adds songs, reorders and sets the target key', async () => {
    const a = await createManualSong('Galileu', 'Fernandinho');
    const b = await createManualSong('Lugar Secreto', 'Gabriela Rocha');
    await saveEditedChart(a.id, '[G]Galileu letra');
    await saveEditedChart(b.id, '[E]Lugar Secreto letra');
    await updateSong(a.id, { key: 'G' });
    await updateSong(b.id, { key: 'E' });
    const list = await createSetlist('Domingo');
    render(
      <MemoryRouter initialEntries={[`/listas/${list.id}`]}>
        <Routes>
          <Route path="/listas/:id" element={<SetlistEdit />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar cifras' }));
    await userEvent.type(await screen.findByLabelText('Buscar música para adicionar'), 'gal');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar Galileu' }));
    await userEvent.clear(screen.getByLabelText('Buscar música para adicionar'));
    await userEvent.type(screen.getByLabelText('Buscar música para adicionar'), 'lugar');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar Lugar Secreto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar (2)' }));
    await waitFor(async () => expect((await db.setlists.get(list.id))!.items.map((i) => i.songId)).toEqual([a.id, b.id]));
    const stableIds = (await db.setlists.get(list.id))!.items.map(item => item.id);
    expect(new Set(stableIds).size).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: 'Descer Galileu' }));
    await waitFor(async () => expect((await db.setlists.get(list.id))!.items.map((i) => i.songId)).toEqual([b.id, a.id]));
    expect((await db.setlists.get(list.id))!.items.map(item => item.id)).toEqual([...stableIds].reverse());

    await choose('Tom de Galileu', 'A');
    await waitFor(async () => expect((await db.setlists.get(list.id))!.items[1]!.targetKey).toBe('A'));
  });
});
