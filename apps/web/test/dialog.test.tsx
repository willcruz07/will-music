import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DialogHost, alertDialog, confirmDialog } from '../src/ui/Dialog.tsx';

describe('app dialogs instead of confirm/alert', () => {
  it('confirm: the primary button resolves true', async () => {
    render(<DialogHost />);
    let answer: Promise<boolean>;
    act(() => {
      answer = confirmDialog({ title: 'Excluir música', message: 'Excluir “Asa Branca” da biblioteca?', confirmLabel: 'Excluir' });
    });
    const dialog = screen.getByRole('alertdialog', { name: 'Excluir música' });
    expect(dialog).toHaveTextContent('Excluir “Asa Branca” da biblioteca?');
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await expect(answer!).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('confirm: Cancelar and Escape resolve false', async () => {
    render(<DialogHost />);
    let first: Promise<boolean>;
    act(() => {
      first = confirmDialog({ message: 'Sair sem salvar?' });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await expect(first!).resolves.toBe(false);
    let second: Promise<boolean>;
    act(() => {
      second = confirmDialog({ message: 'Sair sem salvar?' });
    });
    await userEvent.keyboard('{Escape}');
    await expect(second!).resolves.toBe(false);
  });

  it('alert: one OK button', async () => {
    render(<DialogHost />);
    let done: Promise<void>;
    act(() => {
      done = alertDialog('O pacote não pôde ser lido.');
    });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    await expect(done!).resolves.toBeUndefined();
  });

  it('shows dialogs one at a time, in order', async () => {
    render(<DialogHost />);
    act(() => {
      void alertDialog('Primeira');
      void alertDialog('Segunda');
    });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Primeira');
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Segunda');
  });
});
