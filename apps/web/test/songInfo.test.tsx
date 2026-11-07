import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SongInfoForm } from '../src/components/SongInfoForm.tsx';
import { setChordProMeta } from '../src/lib/chordProEdit.ts';
import type { Song } from '../src/lib/db.ts';
import { choose } from './choose.ts';

const song: Song = { id: 's', title: 'Velho nome', artist: '', durationSec: 1, favorite: false, analysisStatus: 'done', createdAt: '', updatedAt: '' };

describe('song info', () => {
  it('rewrites title and artist directives without touching the rest', () => {
    expect(setChordProMeta('{title: a}\n[G]x', { title: 'b', artist: 'c' })).toBe('{title: b}\n{artist: c}\n[G]x');
    expect(setChordProMeta('{title: a}\n{artist: z}\n[G]x', { title: 'a', artist: '' })).toBe('{title: a}\n[G]x');
    expect(setChordProMeta('[G]x', { title: 'b', artist: '' })).toBe('{title: b}\n[G]x');
  });

  it('saves the edited fields', async () => {
    const onSave = vi.fn();
    render(<SongInfoForm song={song} onSave={onSave} />);
    await userEvent.clear(screen.getByLabelText('Música'));
    await userEvent.type(screen.getByLabelText('Música'), 'Primeiros Passos');
    await userEvent.type(screen.getByLabelText('Artista'), 'Ton Carfi');
    await choose('Capotraste', 'Casa 2');
    await userEvent.type(screen.getByLabelText('Andamento (BPM)'), '118');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar dados' }));
    expect(onSave).toHaveBeenCalledWith({ title: 'Primeiros Passos', artist: 'Ton Carfi', capo: 2, tempo: 118 });
  });
});
