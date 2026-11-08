import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConstellationView } from '../src/constellation/ConstellationView.tsx';
import { parseChord } from '../src/constellation/harmony.ts';
import { openFocus, previewStars, startWeb } from '../src/constellation/web.ts';

const web = () => openFocus(startWeb(parseChord('C7M')!));
const handlers = () => ({ onSelect: vi.fn(), onWalk: vi.fn(), onFocusStar: vi.fn(), onOpen: vi.fn() });

describe('ConstellationView', () => {
  it('first tap selects a neighbor, second tap walks', async () => {
    const h = handlers();
    const { rerender } = render(<ConstellationView web={web()} selected={null} {...h} />);
    await userEvent.click(screen.getByRole('button', { name: /^Dm7, / }));
    expect(h.onSelect).toHaveBeenCalledWith('2:min');
    expect(h.onWalk).not.toHaveBeenCalled();
    rerender(<ConstellationView web={web()} selected="2:min" {...h} />);
    await userEvent.click(screen.getByRole('button', { name: /^Dm7, / }));
    expect(h.onWalk).toHaveBeenCalledWith('2:min');
  });

  it('a drag over a star neither selects nor walks', () => {
    const h = handlers();
    render(<ConstellationView web={web()} selected={null} {...h} />);
    const star = screen.getByRole('button', { name: /^Dm7, / });
    fireEvent.pointerDown(star, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(star, { clientX: 130, clientY: 100, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(star, { clientX: 130, clientY: 100, pointerId: 1, pointerType: 'touch' });
    fireEvent.click(star);
    expect(h.onSelect).not.toHaveBeenCalled();
    expect(h.onWalk).not.toHaveBeenCalled();
  });

  it('preview stars are visible but not buttons', () => {
    const w = web();
    render(<ConstellationView web={w} selected={null} {...handlers()} />);
    const ring = screen.getByTestId('preview-ring');
    expect(ring.querySelectorAll('[data-star]').length).toBe(previewStars(w).length);
    expect(ring.querySelector('[role="button"]')).toBeNull();
  });

  it('labels every orbit star with its motion', () => {
    render(<ConstellationView web={openFocus(startWeb(parseChord('G7')!))} selected={null} {...handlers()} />);
    expect(screen.getByRole('button', { name: 'C7M, resolve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C7, tensiona' })).toBeInTheDocument();
  });

  it('shows the sectors of the current orbit as a legend', () => {
    const { unmount } = render(<ConstellationView web={web()} selected={null} {...handlers()} />);
    expect(screen.getByText('Relaxar')).toBeInTheDocument();
    expect(screen.getByText('Tensionar')).toBeInTheDocument();
    expect(screen.queryByText('Resolver')).toBeNull();
    unmount();
    render(<ConstellationView web={openFocus(startWeb(parseChord('G7')!))} selected={null} {...handlers()} />);
    expect(screen.getByText('Resolver')).toBeInTheDocument();
  });

  it('the orbit is reachable by keyboard and Enter walks', async () => {
    const h = handlers();
    render(<ConstellationView web={web()} selected={null} {...h} />);
    await userEvent.tab();
    const first = document.activeElement as HTMLElement;
    expect(first.getAttribute('role')).toBe('button');
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).not.toBe(first);
    await userEvent.keyboard('{Enter}');
    expect(h.onWalk).toHaveBeenCalledTimes(1);
  });

  it('a closed starting star opens its orbit when tapped', async () => {
    const h = handlers();
    render(<ConstellationView web={startWeb(parseChord('C7M')!)} selected={null} {...h} />);
    await userEvent.click(screen.getByRole('button', { name: /Abrir os caminhos de C7M/ }));
    expect(h.onOpen).toHaveBeenCalled();
  });
});

describe('ConstellationView: review fixes', () => {
  it('draws one preview bubble per chord', () => {
    const w = web();
    render(<ConstellationView web={w} selected={null} {...handlers()} />);
    const keys = new Set(previewStars(w).filter((s) => !w.nodes[s.key]).map((s) => s.key));
    expect(screen.getByTestId('preview-ring').querySelectorAll('[data-bubble]').length).toBe(keys.size);
  });

  it('wheel zoom does not scroll the page', () => {
    render(<ConstellationView web={web()} selected={null} {...handlers()} />);
    expect(fireEvent.wheel(screen.getByRole('group', { name: /Constelação/ }), { deltaY: 100 })).toBe(false);
  });
});
