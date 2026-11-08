/** The view over the constellation: the point in the middle of the screen and the zoom. */
export type Camera = { x: number; y: number; zoom: number };

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 1.3;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Zooms by `factor` keeping the screen point `at` (pixels from the top-left of a view of `size`) over the same spot
 * of the constellation, as a pinch between two fingers does. The zoom stays within MIN_ZOOM..MAX_ZOOM.
 */
export const zoomAround = (c: Camera, factor: number, at: { x: number; y: number }, size: { w: number; h: number }): Camera => {
  const zoom = clamp(c.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const dx = at.x - size.w / 2;
  const dy = at.y - size.h / 2;
  return { zoom, x: c.x + dx / c.zoom - dx / zoom, y: c.y + dy / c.zoom - dy / zoom };
};

/** Slider position (0..100) for a zoom, on a log scale so each step feels the same in and out. */
export const zoomToSlider = (zoom: number): number =>
  Math.round(((Math.log(clamp(zoom, MIN_ZOOM, MAX_ZOOM)) - Math.log(MIN_ZOOM)) / (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM))) * 100);

export const sliderToZoom = (value: number): number =>
  Math.exp(Math.log(MIN_ZOOM) + (clamp(value, 0, 100) / 100) * (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM)));
