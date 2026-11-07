import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { semitonesTo, stageAction } from '../src/lib/stage.ts';
import { useWakeLock } from '../src/lib/wakeLock.ts';

describe('stage keys', () => {
  it.each([
    ['ArrowRight', 'ArrowRight', 'next'], ['PageDown', 'PageDown', 'next'], ['PageUp', 'PageUp', 'prev'],
    ['ArrowLeft', 'ArrowLeft', 'prev'], [' ', 'Space', 'scroll-down'], ['ArrowDown', 'ArrowDown', 'scroll-down'], ['ArrowUp', 'ArrowUp', 'scroll-up'],
  ] as const)('maps %s', (key, code, action) => expect(stageAction({ key, code })).toBe(action));
  it('ignores keys typed into fields', () => expect(stageAction({ key: ' ', code: 'Space', targetTag: 'INPUT' })).toBeNull());
  it('ignores other keys', () => expect(stageAction({ key: 'a', code: 'KeyA' })).toBeNull());
});

describe('semitones between keys', () => {
  it.each([['G', 'A', 2], ['G', 'E', -3], ['C', 'F#', 6], ['Em', 'Dm', -2], ['Bb', 'Bb', 0], ['A', 'G', -2], ['C', 'Ab', -4]] as const)
    ('%s → %s', (a, b, n) => expect(semitonesTo(a, b)).toBe(n));
});

describe('wake lock', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests the lock and asks again when the page becomes visible', async () => {
    const request = vi.fn(async () => ({ release: vi.fn(async () => {}) }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    renderHook(() => useWakeLock(true));
    await Promise.resolve();
    expect(request).toHaveBeenCalledWith('screen');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing without support', () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
