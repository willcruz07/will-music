import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { startAnalysis } from '../src/lib/jobs.ts';
const mocks = vi.hoisted(() => ({ separate: vi.fn(), sets: vi.fn(async () => []), gpu: vi.fn(async () => true) }));
vi.mock('../src/lib/stems.ts', () => ({ listStemSets: mocks.sets, hasUsableWebGpu: mocks.gpu, separateSong: mocks.separate, deleteStemSet: vi.fn(), selectStemSet: vi.fn() }));
vi.mock('../src/lib/ios.ts', () => ({ isIOS: () => false }));
import { useStems } from '../src/lib/useStems.ts';
afterEach(() => { vi.clearAllMocks(); });
it('starts temporary six-track separation only after the analysis completes', async () => {
  mocks.separate.mockResolvedValue({ persisted: false, record: { songId: 'auto', mode: 'six', tracks: [] } });
  const hook = renderHook(() => useStems('auto', 'blob:original'));
  let finish!: () => void;
  let job!: Promise<void>;
  act(() => { job = startAnalysis('auto', () => new Promise<void>((resolve) => { finish = resolve; })); });
  expect(mocks.separate).not.toHaveBeenCalled();
  await act(async () => { finish(); await job; });
  await waitFor(() => expect(mocks.separate).toHaveBeenCalledTimes(1));
  expect(mocks.separate.mock.calls[0]?.[2]).toMatchObject({ mode: 'six', persist: false });
  hook.unmount();
});
it('does not separate after failed analysis or without a compatible GPU', async () => {
  const hook = renderHook(() => useStems('failed', 'blob:original'));
  await act(async () => { await expect(startAnalysis('failed', async () => { throw new Error('failed'); })).rejects.toThrow(); });
  expect(mocks.separate).not.toHaveBeenCalled();
  mocks.gpu.mockResolvedValueOnce(false);
  await act(async () => { await startAnalysis('failed', async () => {}); });
  expect(mocks.separate).not.toHaveBeenCalled();
  hook.unmount();
});
