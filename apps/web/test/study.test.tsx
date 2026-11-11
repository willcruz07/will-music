import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { StudyPage } from '../src/pages/StudyPage.tsx';

const open = (url = '/estudo') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <StudyPage />
    </MemoryRouter>,
  );

describe('study section', () => {
  it('explains how a chord is built when root and type are chosen', async () => {
    open();
    await userEvent.click(screen.getByRole('radio', { name: 'D (Ré)' }));
    await userEvent.click(screen.getByRole('radio', { name: /^m7$/ }));
    const formation = screen.getByRole('region', { name: 'Formação de Dm7' });
    expect(within(formation).getByText('D')).toBeInTheDocument();
    expect(within(formation).getByText('F')).toBeInTheDocument();
    expect(within(formation).getByText(/terça menor/)).toBeInTheDocument();
    expect(within(formation).getAllByText(/sétima menor/).length).toBeGreaterThan(0);
  });

  it('opens on the chord asked for in the link', () => {
    open('/estudo?acorde=Bb7M');
    expect(screen.getByRole('region', { name: 'Formação de Bb7M' })).toBeInTheDocument();
  });

  it('shows the grid of every root for a chord type', async () => {
    open();
    await userEvent.click(screen.getByRole('radio', { name: 'Todas as notas' }));
    const grid = screen.getByRole('list', { name: 'Grade de acordes' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(12);
  });

  it('builds the harmonic field of the chosen key', async () => {
    open();
    await userEvent.click(screen.getByRole('tab', { name: 'Escalas e campo harmônico' }));
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Tom' })).getByRole('radio', { name: 'G (Sol)' }));
    const field = screen.getByRole('list', { name: 'Campo harmônico' });
    expect(within(field).getAllByRole('button', { name: /^Tríade/ }).map((b) => b.textContent)).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#m(b5)']);
    expect(within(field).getByRole('button', { name: 'Tétrade F#m7(b5)' })).toBeInTheDocument();
    expect(screen.getByText(/G · A · B · C · D · E · F#/)).toBeInTheDocument();
  });

  it('has a theory page about intervals and triads', async () => {
    open();
    await userEvent.click(screen.getByRole('tab', { name: 'Formação' }));
    expect(screen.getByRole('heading', { name: /Intervalos/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tríades/ })).toBeInTheDocument();
  });
});

describe('pending fixes: keyboard', () => {
  it('moves through a radio group with the arrow keys', async () => {
    open();
    const c = screen.getByRole('radio', { name: 'C (Dó)' });
    c.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'C# (Dó#)' })).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'C# (Dó#)' }));
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'B (Si)' })).toHaveAttribute('aria-checked', 'true');
  });
});
