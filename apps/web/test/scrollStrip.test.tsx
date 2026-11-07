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
