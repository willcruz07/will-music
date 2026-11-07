import { describe, expect, it, vi } from 'vitest';
import { isRunning, startAnalysis, subscribeAnalysis } from '../src/lib/jobs.ts';

describe('analysis jobs', () => {
  it('lets a page that mounts later follow a running analysis to the end', async () => {
    let report!: (p: { label: string }) => void;
    let finish!: () => void;
    const run = vi.fn((onProgress: (p: { label: string }) => void) => {
      report = onProgress;
      return new Promise<void>((resolve) => (finish = resolve));
    });
    const first = startAnalysis('s1', run);
    report({ label: 'Detectando os acordes (1 de 2)' });
    expect(startAnalysis('s1', run)).toBe(first);
    expect(run).toHaveBeenCalledTimes(1);
    expect(isRunning('s1')).toBe(true);

    const events: unknown[] = [];
    subscribeAnalysis('s1', (e) => events.push(e));
    expect(events).toEqual([{ label: 'Detectando os acordes (1 de 2)' }]);
    finish();
    await first;
    expect(events.at(-1)).toBe('done');
    expect(isRunning('s1')).toBe(false);
  });

  it('notifies done even when the analysis fails', async () => {
    const events: unknown[] = [];
    const job = startAnalysis('s2', async () => {
      throw new Error('falhou');
    });
    subscribeAnalysis('s2', (e) => events.push(e));
    await expect(job).rejects.toThrow('falhou');
    expect(events).toEqual(['done']);
    expect(isRunning('s2')).toBe(false);
  });
});
