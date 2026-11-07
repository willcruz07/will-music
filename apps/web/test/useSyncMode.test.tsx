import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { syncKeyAction, useSyncMode } from '../src/lib/useSyncMode.ts';

describe('sync mode hook', () => {
  it('survives re-renders with a new save callback and saves once on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    let now = 0;
    const { result, rerender, unmount } = renderHook(({ onSave }) => useSyncMode({ onSave, currentTime: () => now }), { initialProps: { onSave: first } });
    act(() => result.current.start(3, [null, null, null]));
    now = 1.2;
    act(() => result.current.mark());
    rerender({ onSave: second });
    expect(result.current.syncing).toBe(true);
    expect(first).not.toHaveBeenCalled();
    unmount();
    expect(second).toHaveBeenCalledWith([1.2, null, null]);
    expect(first).not.toHaveBeenCalled();
  });

  it('finishes by itself after the last line', () => {
    const onSave = vi.fn();
    let now = 0;
    const { result } = renderHook(() => useSyncMode({ onSave, currentTime: () => now }));
    act(() => result.current.start(1, [5]));
    now = 2;
    act(() => result.current.mark());
    expect(result.current.syncing).toBe(false);
    expect(onSave).toHaveBeenCalledWith([2]);
  });

  it('ignores keys typed into fields', () => {
    expect(syncKeyAction({ code: 'Space', key: ' ' })).toBe('mark');
    expect(syncKeyAction({ code: 'ArrowLeft', key: 'ArrowLeft' })).toBe('back');
    expect(syncKeyAction({ code: 'Space', key: ' ', targetTag: 'INPUT' })).toBeNull();
    expect(syncKeyAction({ code: 'ArrowLeft', key: 'ArrowLeft', targetTag: 'TEXTAREA' })).toBeNull();
  });
});
