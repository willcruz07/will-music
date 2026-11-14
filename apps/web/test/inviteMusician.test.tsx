import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../src/lib/cloud/sharing.ts', () => ({ sendMusicianSetlistInvite: fake.send, sharingError: (error: unknown) => String(error) }));
import { InviteMusician } from '../src/components/InviteMusician.tsx';
import { db } from '../src/lib/db.ts';
import { emptyMusicianProfile } from '../src/lib/musicianProfile.ts';
import { publicMusicianData, readPublicMusician } from '../src/lib/musicians.ts';
const musician = readPublicMusician('guest', publicMusicianData({ name: 'Convidado', musicianProfile: { ...emptyMusicianProfile(), acceptsInvites: true } }, null));
beforeEach(async () => {
  await db.setlists.clear(); fake.send.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
it('lets the user choose an owned setlist and sends only after explicit confirmation', async () => {
  const list = { id: 'owned', name: 'Ensaio de domingo', items: [{ songId: 'chart' }], createdAt: '', updatedAt: '' };
  await db.setlists.put(list);
  render(<MemoryRouter><InviteMusician musician={musician} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: 'Convidar para uma setlist' }));
  expect(fake.send).not.toHaveBeenCalled();
  await userEvent.click(await screen.findByRole('radio', { name: /Ensaio de domingo/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));
  await waitFor(() => expect(fake.send).toHaveBeenCalledWith(list, 'guest'));
  expect(await screen.findByRole('status')).toHaveTextContent('Convite enviado para Convidado');
  expect(screen.queryByRole('textbox', { name: /mail/ })).toBeNull();
});
