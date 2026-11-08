import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConstellationPage } from '../src/pages/ConstellationPage.tsx';
import { StudyHome } from '../src/pages/StudyHome.tsx';
import { choose } from './choose.ts';

const play = vi.fn();
vi.mock('../src/study/widgets.tsx', async (orig) => ({
  ...(await orig<typeof import('../src/study/widgets.tsx')>()),
  useStudySynth: () => ({ play, stop: vi.fn(), playing: null }),
}));

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
const star = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}, `) });
/** First tap selects (touch-like: no hover), then "Ir" walks with the suggested type. */
const goTo = async (name: string) => {
  await userEvent.pointer({ keys: '[TouchA]', target: star(name) });
  await userEvent.click(screen.getByRole('button', { name: 'Ir' }));
};

beforeEach(() => play.mockClear());

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

  it('starts from Db', async () => {
    open();
    await choose('Fundamental', 'Db');
    await userEvent.click(screen.getByRole('button', { name: 'Começar' }));
    expect(screen.getByRole('button', { name: /Abrir os caminhos de Db7M/ })).toBeInTheDocument();
  });

  it('walking writes one short line per step in the path diary', async () => {
    await startAtC();
    await goTo('Dm7');
    await goTo('G7');
    expect(screen.getByTestId('progression')).toHaveTextContent('C7M → Dm7 → G7');
    expect(within(screen.getByRole('list', { name: 'Caminho' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('each chord in the diary is written in the color of its step (a tension is not green)', async () => {
    await startAtC();
    await goTo('Dm7');
    await goTo('G7');
    const diary = screen.getByRole('list', { name: 'Caminho' });
    const g7 = within(diary).getByRole('button', { name: 'Voltar para G7' });
    const motion = within(g7.closest('li')!).getByText('tensiona');
    expect(g7.style.color).toBe(motion.style.color);
    expect(g7.style.color).not.toBe('');
  });

  it('the diary shows the pattern of motions', async () => {
    await startAtC();
    await goTo('Am7');
    await goTo('G7');
    await goTo('C7M');
    expect(screen.getByTestId('pattern')).toHaveTextContent('relaxa → tensiona → resolve');
  });

  it('the balloon lists the types of the chosen root with a hint, and choosing one only selects', async () => {
    await startAtC();
    await userEvent.pointer({ keys: '[TouchA]', target: star('G7') });
    const balloon = screen.getByRole('dialog', { name: /G/ });
    expect(within(balloon).getByRole('radio', { name: /^G7,/ })).toBeChecked();
    await userEvent.click(within(balloon).getByRole('radio', { name: /^G7\(b9\)/ }));
    expect(within(balloon).getByRole('radio', { name: /^G7\(b9\)/ })).toBeChecked();
    expect(within(balloon).getByText(/tensão escura/)).toBeInTheDocument();
    expect(play).toHaveBeenLastCalledWith(expect.any(String), expect.any(Array));
    expect(screen.getByTestId('progression')).toHaveTextContent(/^C7M$/);
    await userEvent.click(within(balloon).getByRole('button', { name: 'Ir' }));
    expect(screen.getByTestId('progression')).toHaveTextContent('C7M → G7(b9)');
    // The dark color asks for the minor resolution first.
    expect(screen.getByRole('button', { name: 'Cm7, resolve' })).toBeInTheDocument();
  });

  it('plays the chord when selecting and the whole trail on demand', async () => {
    await startAtC();
    await userEvent.pointer({ keys: '[TouchA]', target: star('Dm7') });
    expect(play).toHaveBeenLastCalledWith(expect.any(String), expect.any(Array));
    await userEvent.click(screen.getByRole('button', { name: 'Ir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir o caminho' }));
    const events = play.mock.lastCall![1] as { time: number }[];
    expect(new Set(events.map((e) => e.time)).size).toBe(2);
  });

  it('lets keyboard users go back to an earlier chord from the diary', async () => {
    await startAtC();
    await goTo('Dm7');
    await goTo('G7');
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para Dm7' }));
    expect(screen.getByTestId('progression')).toHaveTextContent('C7M → Dm7');
    expect(screen.getByTestId('progression')).not.toHaveTextContent('G7');
  });

  it('reset clears the trail back to the starting chord', async () => {
    await startAtC();
    await goTo('Dm7');
    await goTo('G7');
    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(screen.getByTestId('progression')).toHaveTextContent(/^C7M$/);
  });

  it('has no target mode', async () => {
    await startAtC();
    expect(screen.queryByLabelText(/Alvo/)).toBeNull();
    expect(screen.queryByText(/Chegar em um acorde/)).toBeNull();
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

describe('review 2 fixes: page', () => {
  it('hovering the selected star again keeps the type chosen in the balloon', async () => {
    await startAtC();
    await userEvent.pointer({ keys: '[TouchA]', target: star('G7') });
    const balloon = screen.getByRole('dialog', { name: /G/ });
    await userEvent.click(within(balloon).getByRole('radio', { name: /^G7\(b9\)/ }));
    play.mockClear();
    await userEvent.hover(star('G7'));
    expect(within(screen.getByRole('dialog', { name: /G/ })).getByRole('radio', { name: /^G7\(b9\)/ })).toBeChecked();
    expect(play).not.toHaveBeenCalled();
  });

  it('Escape closes the balloon from anywhere', async () => {
    await startAtC();
    await userEvent.pointer({ keys: '[TouchA]', target: star('G7') });
    expect(screen.getByRole('dialog', { name: /G/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /G/ })).toBeNull();
  });
});

describe('the progression in the colors of its actions', () => {
  it('colors each chord of "Seu caminho" with its step', async () => {
    await startAtC();
    await goTo('Am7');
    await goTo('G7');
    const chords = within(screen.getByTestId('progression')).getAllByTestId('chord');
    expect(chords.map((c) => c.textContent)).toEqual(['C7M', 'Am7', 'G7']);
    expect(chords[1]!.getAttribute('data-motion')).toBe('relaxa');
    expect(chords[2]!.getAttribute('data-motion')).toBe('tensiona');
  });
});
