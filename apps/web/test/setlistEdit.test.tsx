import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSong, db, updateSong } from '../src/lib/db.ts';
import { createSetlist, keyOptions } from '../src/lib/setlists.ts';
import { SetlistEdit } from '../src/pages/SetlistEdit.tsx';

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
    const a = await createSong({ title: 'Galileu', artist: 'Fernandinho', durationSec: 1 }, new Blob());
    const b = await createSong({ title: 'Lugar Secreto', artist: 'Gabriela Rocha', durationSec: 1 }, new Blob());
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
    await userEvent.type(await screen.findByLabelText('Buscar música para adicionar'), 'gal');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar Galileu' }));
    await userEvent.clear(screen.getByLabelText('Buscar música para adicionar'));
    await userEvent.type(screen.getByLabelText('Buscar música para adicionar'), 'lugar');
    await userEvent.click(await screen.findByRole('button', { name: 'Adicionar Lugar Secreto' }));
    await waitFor(async () => expect((await db.setlists.get(list.id))!.items.map((i) => i.songId)).toEqual([a.id, b.id]));

    await userEvent.click(screen.getByRole('button', { name: 'Descer Galileu' }));
    await waitFor(async () => expect((await db.setlists.get(list.id))!.items.map((i) => i.songId)).toEqual([b.id, a.id]));

    await userEvent.selectOptions(screen.getByLabelText('Tom de Galileu'), 'A');
    await waitFor(async () => expect((await db.setlists.get(list.id))!.items[1]!.targetKey).toBe('A'));
  });
});
