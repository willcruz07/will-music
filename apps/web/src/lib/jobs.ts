import type { PipelineProgress } from './pipeline.ts';

type Event = PipelineProgress | 'done';
type Job = { promise: Promise<void>; progress?: PipelineProgress; listeners: Set<(e: Event) => void> };

// Lives outside React so a song page mounted later can follow an analysis that is already running.
const jobs = new Map<string, Job>();

export const isRunning = (songId: string): boolean => jobs.has(songId);

export const startAnalysis = (songId: string, run: (onProgress: (p: PipelineProgress) => void) => Promise<void>): Promise<void> => {
  const existing = jobs.get(songId);
  if (existing) return existing.promise;
  const job: Job = { promise: Promise.resolve(), listeners: new Set() };
  jobs.set(songId, job);
  job.promise = (async () => {
    try {
      await run((p) => {
        job.progress = p;
        for (const listener of job.listeners) listener(p);
      });
    } finally {
      jobs.delete(songId);
      for (const listener of job.listeners) listener('done');
    }
  })();
  return job.promise;
};

export const subscribeAnalysis = (songId: string, listener: (e: Event) => void): (() => void) => {
  const job = jobs.get(songId);
  if (!job) return () => {};
  job.listeners.add(listener);
  if (job.progress) listener(job.progress);
  return () => job.listeners.delete(listener);
};
