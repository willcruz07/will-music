import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AboutButton } from '../src/components/About.tsx';

describe('Sobre: bottom sheet about the author', () => {
  it('opens a sheet with the photo, contacts and Pix, and closes on Escape', async () => {
    render(<AboutButton />);
    const trigger = screen.getByRole('button', { name: /Conheça o will-music/ });
    await userEvent.click(trigger);
    const sheet = screen.getByRole('dialog', { name: /Will Cruz/ });
    expect(within(sheet).getByRole('img', { name: /Will Cruz/ })).toHaveAttribute('src', expect.stringContaining('will.jpeg'));
    expect(within(sheet).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/5521981314531');
    expect(within(sheet).getByRole('link', { name: /Instagram/ })).toHaveAttribute('href', 'https://www.instagram.com/willcruz_k07/');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('copies the Pix key, and shows it when copying is not allowed', async () => {
    const user = userEvent.setup();
    render(<AboutButton variant="row" />);
    await user.click(screen.getByRole('button', { name: /Sobre o will-music/ }));
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: /Copiar chave Pix/ }));
    expect(write).toHaveBeenCalledWith('21981314531');
    expect(screen.getByRole('button', { name: /Chave Pix copiada/ })).toBeInTheDocument();

    write.mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByRole('button', { name: /Chave Pix copiada/ }));
    expect(screen.getByRole('status')).toHaveTextContent('A chave é: 21981314531');
  });
});

describe('BottomSheet: close button', () => {
  it('a press on the close button does not start a drag (pointer capture would steal its click)', async () => {
    const capture = vi.fn();
    const original = Element.prototype.setPointerCapture;
    Element.prototype.setPointerCapture = capture;
    try {
      render(<AboutButton />);
      await userEvent.click(screen.getByRole('button', { name: /Conheça o will-music/ }));
      const close = within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' });
      fireEvent.pointerDown(close, { pointerId: 1, clientY: 10 });
      expect(capture).not.toHaveBeenCalled();
      fireEvent.pointerUp(close, { pointerId: 1, clientY: 10 });
      await userEvent.click(close);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      Element.prototype.setPointerCapture = original;
    }
  });
});

describe('Sobre: first visit', () => {
  it('opens by itself once, on the first visit only', async () => {
    localStorage.clear();
    const { unmount } = render(<AboutButton autoOpenOnce />);
    expect(await screen.findByRole('dialog', { name: /Will Cruz/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    unmount();
    render(<AboutButton autoOpenOnce />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conheça o will-music/ })).toBeInTheDocument();
  });

  it('does not open by itself without autoOpenOnce (Ajustes)', () => {
    localStorage.clear();
    render(<AboutButton variant="row" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a wide sheet on desktop', async () => {
    render(<AboutButton />);
    await userEvent.click(screen.getByRole('button', { name: /Conheça o will-music/ }));
    expect(screen.getByRole('dialog').className).not.toMatch(/max-w-/);
    expect(screen.getByRole('dialog').className).toContain('max-h-[92dvh]');
  });
});
