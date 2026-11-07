import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SheetSelect } from '../src/ui/SheetSelect.tsx';

const Keys = ({ groups = false }: { groups?: boolean }) => {
  const [v, setV] = useState('C');
  return (
    <>
      <SheetSelect
        label="Tom"
        value={v}
        onChange={setV}
        options={['C', 'D', 'E'].map((k, i) => ({ value: k, label: k, ...(groups ? { group: i < 2 ? 'Primeiros' : 'Outros' } : {}) }))}
      />
      <output data-testid="v">{v}</output>
    </>
  );
};

describe('SheetSelect: a select that opens a bottom sheet', () => {
  it('looks like a select showing the current value', () => {
    render(<Keys />);
    const trigger = screen.getByLabelText('Tom');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveTextContent('C');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a modal sheet listing the options, with the current one marked', async () => {
    render(<Keys />);
    await userEvent.click(screen.getByLabelText('Tom'));
    const sheet = screen.getByRole('dialog', { name: 'Tom' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    const list = within(sheet).getByRole('listbox');
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['C', 'D', 'E']);
    expect(within(list).getByRole('option', { name: 'C' })).toHaveAttribute('aria-selected', 'true');
    expect(within(list).getByRole('option', { name: 'C' })).toHaveFocus();
    expect(screen.getByTestId('sheet-backdrop')).toBeInTheDocument();
  });

  it('picks an option, closes and gives focus back', async () => {
    render(<Keys />);
    const trigger = screen.getByLabelText('Tom');
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('option', { name: 'E' }));
    expect(screen.getByTestId('v')).toHaveTextContent('E');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent('E');
  });

  it('closes without changing on Escape, on the backdrop and on the close button', async () => {
    render(<Keys />);
    await userEvent.click(screen.getByLabelText('Tom'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Tom'));
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Tom'));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('v')).toHaveTextContent('C');
  });

  it('moves through the options with the arrow keys and picks with Enter', async () => {
    render(<Keys />);
    await userEvent.click(screen.getByLabelText('Tom'));
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'D' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('v')).toHaveTextContent('D');
  });

  it('shows group titles', async () => {
    render(<Keys groups />);
    await userEvent.click(screen.getByLabelText('Tom'));
    expect(screen.getByRole('group', { name: 'Primeiros' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Outros' })).toBeInTheDocument();
  });

  it('locks the page scroll while open', async () => {
    render(<Keys />);
    await userEvent.click(screen.getByLabelText('Tom'));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });
});

describe('SheetSelect: hints', () => {
  it('names each option by its label and reads the hint as a description', async () => {
    const Hinted = () => {
      const [v, setV] = useState('C');
      return <SheetSelect label="Tom" value={v} onChange={setV} options={[{ value: 'C', label: 'C', hint: 'Dó' }, { value: 'D', label: 'D', hint: 'Ré' }]} />;
    };
    render(<Hinted />);
    await userEvent.click(screen.getByLabelText('Tom'));
    expect(screen.getByRole('option', { name: 'D' })).toHaveAccessibleDescription('Ré');
  });
});
