import { describe, expect, it, vi } from 'vitest';
import { createHistory } from '../src/lib/history.ts';

describe('edit history', () => {
  it('groups fast typing and undoes/redoes', () => {
    vi.useFakeTimers();
    const h = createHistory('');
    h.set('a');
    vi.advanceTimersByTime(100);
    h.set('ab');
    vi.advanceTimersByTime(700);
    h.set('abc');
    expect(h.value).toBe('abc');
    h.undo();
    expect(h.value).toBe('ab');
    h.undo();
    expect(h.value).toBe('');
    expect(h.canUndo).toBe(false);
    h.redo();
    expect(h.value).toBe('ab');
    h.set('x');
    expect(h.canRedo).toBe(false);
    vi.useRealTimers();
  });
});
