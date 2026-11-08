import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConstellationPage } from '../src/pages/ConstellationPage.tsx';
import { StudyHome } from '../src/pages/StudyHome.tsx';
import * as route from '../src/constellation/route.ts';
import { choose } from './choose.ts';

const play = vi.fn();
vi.mock('../src/study/widgets.tsx', async (orig) => ({
  ...(await orig<typeof import('../src/study/widgets.tsx')>()),
  useStudySynth: () => ({ play, stop: vi.fn(), playing: null }),
}));
vi.mock('../src/constellation/route.ts', async (orig) => {
  const real = await orig<typeof import('../src/constellation/route.ts')>();
  return { ...real, suggestRoute: vi.fn(real.suggestRoute) };
});

const open = () =>
  render(
    <MemoryRouter>
      <ConstellationPage />
    </MemoryRouter>,
  );

/** Starts at C7M and opens its orbit. */
const startAtC = async () => {
  open();
  await userEvent.click(screen.getByRole('button', { name: 'Começar' }));
  await userEvent.click(screen.getByRole('button', { name: /Abrir os caminhos de C7M/ }));
};
/** First tap selects, second tap walks (touch-like: no hover). */
const goTo = async (name: string) => {
  const star = screen.getByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}, `) });
  await userEvent.pointer({ keys: '[TouchA]', target: star });
  await userEvent.click(screen.getByRole('button', { name: 'Ir' }));
};

beforeEach(() => {
  play.mockClear();
  vi.mocked(route.suggestRoute).mockClear();
});

describe('Constelação de acordes page', () => {
  it('starts from a chosen chord and opens its orbit on tap', async () => {
    open();
    await choose('Fundamental', 'D');
    await choose('Tipo', 'Menor com sétima');
    await userEvent.click(screen.getByRole('button', { name: 'Começar' }));
    expect(screen.queryByRole('button', { name: /^G7, / })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Abrir os caminhos de Dm7/ }));
    expect(within(screen.getByRole('group', { name: /Constelação/ })).getAllByRole('button').length).toBeGreaterThanOrEqual(6);
  });

  it('walking writes one short line per step in the path diary', async () => {
    await startAtC();
    await goTo('Dm7');
    await goTo('G7');
    const diary = screen.getByRole('list', { name: 'Caminho' });
    expect(screen.getByTestId('progression')).toHaveTextContent('C7M → Dm7 → G7');
    expect(within(diary).getAllByRole('listitem')).toHaveLength(2);
  });

  it('plays the chord when selecting and the whole trail on demand', async () => {
    await startAtC();
    await userEvent.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: /^Dm7, / }) });
    expect(play).toHaveBeenLastCalledWith(expect.any(String), expect.any(Array));
    await userEvent.click(screen.getByRole('button', { name: 'Ir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir o caminho' }));
    const events = play.mock.lastCall![1] as { time: number }[];
    expect(new Set(events.map((e) => e.time)).size).toBe(2);
  });

  it('target mode suggests a route and recalculates after a detour', async () => {
    await startAtC();
    await choose('Alvo: fundamental', 'Bb');
    await choose('Alvo: tipo', 'Sétima maior');
    expect(screen.getByTestId('suggestion')).toHaveTextContent(/Bb7M$/);
    const calls = vi.mocked(route.suggestRoute).mock.calls.length;
    await goTo('Am7');
    expect(vi.mocked(route.suggestRoute).mock.calls.length).toBeGreaterThan(calls);
    expect(screen.getByTestId('suggestion')).toHaveTextContent(/^Sugestão até Bb7M: Am7 →/);
  });

  it('says so when the target is the current chord or unreachable', async () => {
    await startAtC();
    await choose('Alvo: fundamental', 'C');
    await choose('Alvo: tipo', 'Sétima maior');
    expect(screen.getByTestId('suggestion')).toHaveTextContent('Você já está em C7M.');
    vi.mocked(route.suggestRoute).mockReturnValueOnce(null);
    await choose('Alvo: fundamental', 'F#');
    expect(screen.getByTestId('suggestion')).toHaveTextContent('Não encontrei um caminho até F#7M em 8 passos.');
  });

  it('reset clears the trail back to the starting chord', async () => {
    await startAtC();
    await goTo('Dm7');
    await goTo('G7');
    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(screen.getByTestId('progression')).toHaveTextContent(/^C7M$/);
  });

  it('is reachable from the Estudo home', () => {
    render(
      <MemoryRouter>
        <StudyHome />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Constelação/ });
    expect(link).toHaveAttribute('href', '/estudo/constelacao');
    expect(link).toHaveTextContent('Explore caminhos de rearmonização');
  });
});

describe('Constelação: review fixes', () => {
  it('target mode explains every suggested step', async () => {
    await startAtC();
    await choose('Alvo: fundamental', 'Bb');
    await choose('Alvo: tipo', 'Sétima maior');
    const steps = within(screen.getByRole('list', { name: 'Passos sugeridos' })).getAllByRole('listitem');
    expect(steps.length).toBeGreaterThanOrEqual(2);
    for (const s of steps) expect(s.textContent!.length).toBeGreaterThan(15);
  });

  it('offers only target types the constellation can reach', async () => {
    await startAtC();
    await userEvent.click(screen.getByLabelText('Alvo: tipo'));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options.some((o) => o!.startsWith('Maior'))).toBe(false);
    expect(options.some((o) => o!.startsWith('Sétima com quarta'))).toBe(false);
    expect(options.some((o) => o!.startsWith('Sétima maior'))).toBe(true);
  });

  it('lets keyboard users go back to an earlier chord from the diary', async () => {
    await startAtC();
    await goTo('Dm7');
    await goTo('G7');
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para Dm7' }));
    expect(screen.getByTestId('progression')).toHaveTextContent('C7M → Dm7');
    expect(screen.getByTestId('progression')).not.toHaveTextContent('G7');
  });

  it('starts from Db', async () => {
    open();
    await choose('Fundamental', 'Db');
    await userEvent.click(screen.getByRole('button', { name: 'Começar' }));
    expect(screen.getByRole('button', { name: /Abrir os caminhos de Db7M/ })).toBeInTheDocument();
  });
});
