import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSong, db, updateSong } from '../src/lib/db.ts';
import { createSetlist, updateSetlist } from '../src/lib/setlists.ts';
import { Stage } from '../src/pages/Stage.tsx';

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear(), db.setlists.clear()]);
});

const chartFor = (songId: string, text: string) =>
  db.charts.add({ id: crypto.randomUUID(), songId, chordPro: text, transpose: 0, fontSize: 18, origin: 'generated', createdAt: '', updatedAt: '' });

describe('stage page', () => {
  it('opens the first song, skips missing songs and saves the key per item', async () => {
    const a = await createSong({ title: 'Galileu', artist: 'Fernandinho', durationSec: 1 }, new Blob());
    const b = await createSong({ title: 'Lugar Secreto', artist: 'Gabriela Rocha', durationSec: 1 }, new Blob());
    await updateSong(a.id, { key: 'G' });
    await updateSong(b.id, { key: 'E' });
    await chartFor(a.id, '[G]Galileu letra');
    await chartFor(b.id, '[E]Secreto letra');
    const list = await createSetlist('Domingo');
    await updateSetlist(list.id, { items: [{ songId: a.id }, { songId: 'apagada' }, { songId: b.id }] });

    render(
      <MemoryRouter initialEntries={[`/palco/lista/${list.id}`]}>
        <Routes>
          <Route path="/palco/lista/:id" element={<Stage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Galileu' })).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(await screen.findByRole('heading', { name: 'Lugar Secreto' })).toBeInTheDocument();
    expect(screen.getByText('2 de 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Meio tom acima' }));
    await userEvent.click(screen.getByRole('button', { name: 'Meio tom acima' }));
    await waitFor(async () => expect((await db.setlists.get(list.id))!.items[2]!.targetKey).toBe('F#'));
    expect(screen.getAllByText('F#').length).toBeGreaterThan(0);
  });
});
