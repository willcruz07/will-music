import { afterEach, expect, it, vi } from 'vitest';
import { analyzeInWorker } from '../src/worker/client.ts';
afterEach(() => vi.unstubAllGlobals());
it('terminates the chord worker on abort rather than leaving it running after another stage fails', async () => {
  const terminate = vi.fn();
  vi.stubGlobal('Worker', class { terminate = terminate; postMessage() {} });
  const controller = new AbortController();
  const work = analyzeInWorker([new Float32Array(8)], () => {}, controller.signal);
  const expected = expect(work).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await expected;
  expect(terminate).toHaveBeenCalledTimes(1);
});
it('does not create a worker for an already canceled job', async () => {
  const WorkerMock = vi.fn(); vi.stubGlobal('Worker', WorkerMock);
  const controller = new AbortController(); controller.abort();
  await expect(analyzeInWorker([], () => {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(WorkerMock).not.toHaveBeenCalled();
});
