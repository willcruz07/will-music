import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { db } from '../src/lib/db.ts';
import { Library } from '../src/pages/Library.tsx';
import { DialogHost } from '../src/ui/Dialog.tsx';

beforeEach(() => Promise.all([db.songs.clear(), db.charts.clear(), db.analyses.clear()]));

const open = () =>
  render(
    <MemoryRouter>
      <Library />
      <DialogHost />
    </MemoryRouter>,
  );

describe('removing a song from the library list', () => {
  it('asks in the app dialog and removes the song', async () => {
    await createManualSong('Asa Branca', 'Luiz Gonzaga');
    await createManualSong('Garota de Ipanema', 'Tom Jobim');
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir “Asa Branca”' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Asa Branca');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(screen.queryByText('Asa Branca')).toBeNull());
    expect(screen.getByText('Garota de Ipanema')).toBeInTheDocument();
    expect(await db.songs.count()).toBe(1);
  });

  it('keeps the song when cancelled', async () => {
    await createManualSong('Asa Branca', 'Luiz Gonzaga');
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir “Asa Branca”' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Asa Branca')).toBeInTheDocument();
    expect(await db.songs.count()).toBe(1);
  });
});
