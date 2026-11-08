import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, sliderToZoom, zoomAround, zoomToSlider } from '../src/constellation/camera.ts';

const size = { w: 400, h: 300 };

describe('constellation camera', () => {
  it('zooming at the middle keeps the center', () => {
    expect(zoomAround({ x: 10, y: 20, zoom: 1 }, 2, { x: 200, y: 150 }, size)).toEqual({ x: 10, y: 20, zoom: 2 });
  });

  it('zooming between the fingers keeps that spot under them', () => {
    const before = { x: 0, y: 0, zoom: 1 };
    const at = { x: 300, y: 150 }; // 100 px right of the middle: constellation point x = 100
    const after = zoomAround(before, 2, at, size);
    // The same constellation point stays at the same screen spot.
    expect((100 - after.x) * after.zoom + size.w / 2).toBeCloseTo(at.x);
  });

  it('never zooms past the limits', () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 2 }, 10, { x: 0, y: 0 }, size).zoom).toBe(MAX_ZOOM);
    expect(zoomAround({ x: 0, y: 0, zoom: 0.5 }, 0.01, { x: 0, y: 0 }, size).zoom).toBe(MIN_ZOOM);
  });

  it('maps the slider on a log scale, both ways', () => {
    expect(zoomToSlider(MIN_ZOOM)).toBe(0);
    expect(zoomToSlider(MAX_ZOOM)).toBe(100);
    expect(sliderToZoom(0)).toBeCloseTo(MIN_ZOOM);
    expect(sliderToZoom(100)).toBeCloseTo(MAX_ZOOM);
    expect(zoomToSlider(sliderToZoom(37))).toBe(37);
  });
});
