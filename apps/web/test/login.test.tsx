import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from '../src/pages/Login.tsx';
import { accountReturn, RequireAccount } from '../src/components/RequireAccount.tsx';

const fake = vi.hoisted(() => ({ snapshot: { user: null as null | { uid: string; name: string; email: string; photo: null; providers: string[] }, ready: true, error: null }, google: vi.fn(), logout: vi.fn() }));
vi.mock('../src/lib/cloud/personalSync.ts', () => ({ usePersonalSync: () => ({ status: 'idle' }), requestPersonalSync: vi.fn() }));
vi.mock('../src/components/MusicianProfileEditor.tsx', () => ({ MusicianProfileEditor: () => <div>Editor de perfil musical</div> }));
vi.mock('../src/lib/account.ts', () => ({
  useAccount: () => fake.snapshot, prepareGoogle: async () => fake.google, hasGoogleSession: (user: typeof fake.snapshot.user) => !!user?.providers.includes('google.com'),
  leaveAccount: fake.logout, startAccount: vi.fn(), accountError: () => 'Não foi possível entrar.',
}));
const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;
const googleUser = () => ({ uid: 'one', name: 'Musicista', email: 'music@example.com', photo: null, providers: ['google.com'] });
const Harness = ({ url = '/login' }: { url?: string }) => <MemoryRouter initialEntries={[url]}><Routes><Route path="/login" element={<Login />} /><Route path="*" element={<RequireAccount><div>Conteúdo protegido</div></RequireAccount>} /></Routes><Where /></MemoryRouter>;

beforeEach(() => {
  fake.snapshot = { user: null, ready: true, error: null }; fake.google.mockReset().mockResolvedValue(undefined); fake.logout.mockReset();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('Google-only access', () => {
  it('offers only Google and invokes the prepared popup from the click', async () => {
    render(<Harness />);
    expect(screen.queryByLabelText('E-mail')).toBeNull();
    expect(screen.queryByLabelText('Senha')).toBeNull();
    expect(screen.queryByText('Continuar sem entrar')).toBeNull();
    const button = screen.getByRole('button', { name: 'Entrar com Google' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(fake.google).toHaveBeenCalledTimes(1));
  });

  it.each(['/', '/nova', '/musica/teste', '/estudo/constelacao', '/palco/musica/teste', '/catalogo/teste'])('blocks a direct visit to %s and preserves its destination', async url => {
    render(<Harness url={url} />);
    expect(await screen.findByRole('heading', { name: /Seu próximo acorde/ })).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
    expect(screen.getByTestId('where')).toHaveTextContent(`/login?voltar=${encodeURIComponent(url)}`);
  });

  it('waits for session restoration before mounting private content', () => {
    fake.snapshot.ready = false;
    render(<Harness url="/" />);
    expect(screen.getByRole('status')).toHaveTextContent('Restaurando');
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
  });

  it('returns a restored Google session to the requested screen, including offline', () => {
    fake.snapshot.user = googleUser();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<Harness url="/login?voltar=%2Festudo%3Fteste%3D1" />);
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/estudo?teste=1');
  });

  it('rejects a remembered password-only account and external or looping destinations', () => {
    fake.snapshot.user = { ...googleUser(), providers: ['password'] };
    render(<Harness url="/nova" />);
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
    expect(accountReturn('https://example.com')).toBe('/');
    expect(accountReturn('/login?voltar=/login')).toBe('/');
    expect(accountReturn('//example.com')).toBe('/');
  });

  it('blocks a first Google sign-in while offline without offering guest access', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('É preciso conexão');
    expect(screen.queryByRole('link', { name: /Biblioteca|Continuar sem/ })).toBeNull();
  });

  it('keeps account management on its protected screen', () => {
    fake.snapshot.user = googleUser();
    render(<MemoryRouter><Login account /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Minha conta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair desta conta' })).toBeInTheDocument();
  });
});
