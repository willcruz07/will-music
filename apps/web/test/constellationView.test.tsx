import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConstellationView, colorOf, textColorOf } from '../src/constellation/ConstellationView.tsx';
import { chordName, parseChord } from '../src/constellation/harmony.ts';
import { openFocus, orbit, previewStars, startWeb, walk } from '../src/constellation/web.ts';

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
    unmount();
  });

  it('the orbit is reachable by keyboard: Enter selects first, then walks', async () => {
    const h = handlers();
    const { rerender } = render(<ConstellationView web={web()} selected={null} {...h} />);
    await userEvent.tab();
    const first = document.activeElement as HTMLElement;
    expect(first.getAttribute('role')).toBe('button');
    await userEvent.keyboard('{ArrowRight}');
    const second = document.activeElement as HTMLElement;
    expect(second).not.toBe(first);
    h.onSelect.mockClear();
    await userEvent.keyboard('{Enter}');
    expect(h.onWalk).not.toHaveBeenCalled();
    expect(h.onSelect).toHaveBeenCalledWith(second.getAttribute('data-key'));
    rerender(<ConstellationView web={web()} selected={second.getAttribute('data-key')} {...h} />);
    second.focus();
    await userEvent.keyboard('{Enter}');
    expect(h.onWalk).toHaveBeenCalledWith(second.getAttribute('data-key'));
  });

  it('spells every orbit star the way its step is spelled, two steps away from C7M', () => {
    const start = openFocus(startWeb(parseChord('C7M')!));
    for (const first of orbit(start)) {
      const w = walk(start, first.move);
      const { unmount } = render(<ConstellationView web={w} selected={null} {...handlers()} />);
      for (const l of orbit(w)) {
        const label = `${chordName(l.move.to, l.move.nextCenter)}, ${l.move.motion}`;
        expect(screen.getByRole('button', { name: (n) => n === label || n === `${label}, alterado` })).toBeInTheDocument();
      }
      unmount();
    }
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

describe('altered tensions in pink', () => {
  it('marks altered tensions with their own label and legend entry', () => {
    render(<ConstellationView web={web()} selected={null} {...handlers()} />);
    expect(screen.getByRole('button', { name: 'C#°7, tensiona, alterado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'G7, tensiona' })).toBeInTheDocument();
    expect(screen.getByText('Tensão alterada')).toBeInTheDocument();
  });
});

describe('the trail in the colors of its actions', () => {
  it('colors each walked star with the action that reached it', () => {
    let w = openFocus(startWeb(parseChord('C7M')!));
    const toG7 = orbit(w).find((l) => l.to === '7:dom')!.move;
    w = walk(w, toG7);
    const toC = orbit(w).find((l) => l.to === '0:maj')!.move;
    w = walk(w, toC);
    render(<ConstellationView web={w} selected={null} {...handlers()} />);
    const trail = screen.getByTestId('trail');
    expect(trail.querySelector('[data-key="7:dom"]')!.getAttribute('data-color')).toBe(colorOf(toG7));
    expect(trail.querySelector('[data-key="0:maj"]')!.getAttribute('data-color')).toBe(colorOf(toC));
  });

  it('the inner ring of a walked star keeps the color of the step that reached it (not always green)', () => {
    let w = openFocus(startWeb(parseChord('C7M')!));
    // C7M → G7 → F#7 → F#m7 → B7 → E7M: G7 (reached by a tension) ends up off the orbit, as a trail star.
    for (const target of ['7:dom', '6:dom', '6:min', '11:dom', '4:maj']) {
      const link = orbit(w).find((l) => l.to === target)!;
      w = walk(w, link.move);
    }
    render(<ConstellationView web={w} selected={null} {...handlers()} />);
    const rings = [...document.querySelectorAll('[data-ring]')].filter((el) => w.trail.includes(el.getAttribute('data-ring')!));
    expect(rings.length).toBeGreaterThan(0);
    for (const el of rings) {
      const node = w.nodes[el.getAttribute('data-ring')!]!;
      expect(el.getAttribute('stroke'), node.key).toBe(node.via ? colorOf(node.via) : 'var(--primary)');
    }
    // G7 was reached by a tension: its ring is not green.
    const g7 = rings.find((el) => el.getAttribute('data-ring') === '7:dom');
    expect(g7).toBeDefined();
    expect(g7!.getAttribute('stroke')).toBe(colorOf(w.nodes['7:dom']!.via!));
    expect(g7!.getAttribute('stroke')).not.toBe('var(--primary)');
  });

  it('the chord name inside each orbit star is in the color of its move (a tension is not green)', () => {
    const w = openFocus(startWeb(parseChord('G7')!));
    render(<ConstellationView web={w} selected={null} {...handlers()} />);
    const links = orbit(w);
    expect(new Set(links.map((l) => l.move.motion)).size).toBeGreaterThan(1);
    for (const l of links) expect(document.querySelector(`[data-label="${l.to}"]`)!.getAttribute('fill'), l.to).toBe(textColorOf(l.move));
    const tension = links.find((l) => l.move.motion === 'tensiona')!;
    expect(textColorOf(tension.move)).not.toBe('var(--motion-resolve-text)');
  });

  it('always shows the four entries of the legend', () => {
    render(<ConstellationView web={web()} selected={null} {...handlers()} />);
    for (const t of ['Resolver', 'Tensionar', 'Tensão alterada', 'Relaxar']) expect(screen.getByText(t)).toBeInTheDocument();
  });
});

describe('ConstellationView zoom', () => {
  const zoomValue = () => Number((screen.getByRole('slider', { name: 'Zoom' }) as HTMLInputElement).value);

  it('the zoom bar zooms in and out and centers back on the chord', async () => {
    render(<ConstellationView web={web()} selected={null} {...handlers()} />);
    const start = zoomValue();
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar o zoom' }));
    expect(zoomValue()).toBeGreaterThan(start);
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir o zoom' }));
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir o zoom' }));
    expect(zoomValue()).toBeLessThan(start);
    await userEvent.click(screen.getByRole('button', { name: 'Centralizar no acorde' }));
    expect(zoomValue()).toBe(start);
  });

  it('the slider sets the zoom', () => {
    render(<ConstellationView web={web()} selected={null} {...handlers()} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom' }), { target: { value: '90' } });
    expect(zoomValue()).toBe(90);
  });

  it('pinching with two fingers zooms (spreading in, closing out)', () => {
    render(<ConstellationView web={web()} selected={null} {...handlers()} />);
    const svg = screen.getByRole('group', { name: /Constelação/ }).closest('svg')!;
    const start = zoomValue();
    const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', id: number, x: number) => fireEvent[type](svg, { pointerId: id, pointerType: 'touch', clientX: x, clientY: 200 });
    touch('pointerDown', 1, 200);
    touch('pointerDown', 2, 260);
    touch('pointerMove', 2, 280); // past the tap slop: the pinch starts here
    touch('pointerMove', 2, 340);
    touch('pointerMove', 1, 140);
    expect(zoomValue()).toBeGreaterThan(start);
    touch('pointerUp', 1, 140);
    touch('pointerUp', 2, 340);
    const spread = zoomValue();
    touch('pointerDown', 1, 100);
    touch('pointerDown', 2, 400);
    touch('pointerMove', 2, 380);
    touch('pointerMove', 2, 300);
    touch('pointerMove', 1, 200);
    expect(zoomValue()).toBeLessThan(spread);
  });
});
