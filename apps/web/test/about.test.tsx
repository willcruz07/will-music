import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AboutButton } from '../src/components/About.tsx';

describe('Sobre: bottom sheet about the author', () => {
  it('opens a sheet with the photo, contacts and Pix, and closes on Escape', async () => {
    render(<AboutButton />);
    const trigger = screen.getByRole('button', { name: /Will Cruz/ });
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
