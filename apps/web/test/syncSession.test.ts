import { describe, expect, it } from 'vitest';
import { createSyncSession } from '../src/lib/syncSession.ts';

describe('sync session', () => {
  it('marks lines in order, goes back and keeps unmarked times', () => {
    const s = createSyncSession(3, [10, 20, 30]);
    expect(s.next).toBe(0);
    s.mark(1.5);
    s.mark(4);
    expect(s.times).toEqual([1.5, 4, 30]);
    s.back();
    expect(s.next).toBe(1);
    expect(s.times).toEqual([1.5, 20, 30]);
    s.mark(5);
    s.mark(9);
    s.mark(99);
    expect(s.times).toEqual([1.5, 5, 9]);
    expect(s.next).toBe(3);
    expect(s.done).toBe(true);
  });

  it('does nothing on back at the start', () => {
    const s = createSyncSession(2, [null, null]);
    s.back();
    expect(s.next).toBe(0);
    expect(s.times).toEqual([null, null]);
  });
});
