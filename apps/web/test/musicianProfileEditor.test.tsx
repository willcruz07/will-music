import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ user: { uid: 'musician', name: 'Will' } }));
vi.mock('../src/lib/account.ts', () => ({ getAccountState: () => ({ user: fake.user }), applyAccountDisplayName: (_uid: string, name: string) => { fake.user.name = name; } }));
import { db } from '../src/lib/db.ts';
import { MusicianProfileEditor } from '../src/components/MusicianProfileEditor.tsx';
import { getCachedMusician } from '../src/lib/musicianProfileStore.ts';

beforeEach(async () => {
  fake.user.name = 'Will'; await db.settings.clear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
});
it('edits musical choices and restores the saved offline form', async () => {
  const first = render(<MusicianProfileEditor uid="musician" initialName="Will" />);
  fireEvent.change(await screen.findByLabelText('Apelido ou nome artístico'), { target: { value: 'Wellen' } });
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Will Cruz' } });
  await userEvent.click(screen.getByRole('button', { name: 'Teclado' }));
  await userEvent.click(screen.getByRole('button', { name: 'Jazz' }));
  await userEvent.click(screen.getByRole('checkbox', { name: /Receber novos convites/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil neste aparelho' }));
  await waitFor(() => expect(screen.getByText('Perfil salvo neste aparelho. Será enviado quando a conexão voltar.')).toBeInTheDocument());
  expect((await getCachedMusician('musician'))?.account).toMatchObject({ name: 'Will Cruz', musicianProfile: { nickname: 'Wellen', instruments: ['Teclado'], styles: ['Jazz'], acceptsInvites: true } });
  first.unmount(); render(<MusicianProfileEditor uid="musician" initialName="Will" />);
  expect(await screen.findByLabelText('Apelido ou nome artístico')).toHaveValue('Wellen');
  expect(screen.getByRole('button', { name: 'Teclado' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('checkbox', { name: /Receber novos convites/ })).toBeChecked();
});
