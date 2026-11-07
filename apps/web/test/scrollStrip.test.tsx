import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScrollStrip } from '../src/components/ScrollStrip.tsx';

const setSizes = (el: HTMLElement, { scrollWidth, clientWidth, scrollLeft }: { scrollWidth: number; clientWidth: number; scrollLeft: number }) => {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, configurable: true, writable: true });
};

describe('ScrollStrip', () => {
  it('shows a fade on the side that still has options to scroll to', () => {
    render(
      <ScrollStrip label="Assunto">
        <button type="button">Um</button>
        <button type="button">Dois</button>
      </ScrollStrip>,
    );
    const strip = screen.getByTestId('scroll-strip');
    setSizes(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(strip);
    expect(strip.dataset.more).toBe('end');
    setSizes(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 150 });
    fireEvent.scroll(strip);
    expect(strip.dataset.more).toBe('both');
    setSizes(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 300 });
    fireEvent.scroll(strip);
    expect(strip.dataset.more).toBe('start');
  });

  it('has no fade when everything fits', () => {
    render(
      <ScrollStrip label="Assunto">
        <button type="button">Um</button>
      </ScrollStrip>,
    );
    const strip = screen.getByTestId('scroll-strip');
    setSizes(strip, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(strip);
    expect(strip.dataset.more).toBe('none');
  });
});

describe('ScrollStrip: reaching every option without a swipe', () => {
  const strip3 = () => {
    render(
      <ScrollStrip label="Nível">
        <button type="button">Todos os níveis</button>
        <button type="button">Iniciante</button>
        <button type="button">Pro</button>
      </ScrollStrip>,
    );
    const strip = screen.getByTestId('scroll-strip');
    const calls: number[] = [];
    strip.scrollBy = ((opts: ScrollToOptions) => calls.push(opts.left ?? 0)) as typeof strip.scrollBy;
    return { strip, calls };
  };

  it('shows an arrow on each side that still hides options, and it scrolls that way', () => {
    const { strip, calls } = strip3();
    setSizes(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(strip);
    expect(screen.queryByRole('button', { name: 'Ver opções anteriores' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver mais opções' }));
    expect(calls[0]).toBeGreaterThan(0);
    setSizes(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 300 });
    fireEvent.scroll(strip);
    expect(screen.queryByRole('button', { name: 'Ver mais opções' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver opções anteriores' }));
    expect(calls[1]).toBeLessThan(0);
  });

  it('turns the vertical mouse wheel into sideways scrolling when the row overflows', () => {
    const { strip, calls } = strip3();
    setSizes(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(strip);
    fireEvent.wheel(strip, { deltaY: 100 });
    expect(calls).toEqual([100]);
  });

  it('can be dragged sideways with the mouse', () => {
    const { strip } = strip3();
    setSizes(strip, { scrollWidth: 600, clientWidth: 300, scrollLeft: 50 });
    fireEvent.pointerDown(strip, { pointerType: 'mouse', clientX: 200, button: 0 });
    fireEvent.pointerMove(strip, { pointerType: 'mouse', clientX: 120 });
    expect(strip.scrollLeft).toBe(130);
    fireEvent.pointerUp(strip, { pointerType: 'mouse', clientX: 120 });
  });
});
