import type { PipelineProgress } from './pipeline.ts';

type Event = PipelineProgress | 'done';
type Job = { promise: Promise<void>; progress?: PipelineProgress; listeners: Set<(e: Event) => void> };

// Lives outside React so a song page mounted later can follow an analysis that is already running.
const jobs = new Map<string, Job>();
const finishedListeners = new Set<(songId: string, succeeded: boolean) => void>();

/** Observe future jobs too, including analyses started after a song page mounts. */
export const subscribeAnalysisFinished = (listener: (songId: string, succeeded: boolean) => void): (() => void) => {
  finishedListeners.add(listener);
  return () => { finishedListeners.delete(listener); };
};

export const isRunning = (songId: string): boolean => jobs.has(songId);

export const startAnalysis = (songId: string, run: (onProgress: (p: PipelineProgress) => void) => Promise<void>): Promise<void> => {
  const existing = jobs.get(songId);
  if (existing) return existing.promise;
  const job: Job = { promise: Promise.resolve(), listeners: new Set() };
  jobs.set(songId, job);
  job.promise = (async () => {
    let succeeded = false;
    try {
      await run((p) => {
        job.progress = p;
        for (const listener of job.listeners) listener(p);
      });
      // The pipeline can preserve chords while reporting a failed transcription.
      // That partial result must not automatically launch another expensive model.
      succeeded = !job.progress?.tasks?.some((task) => task.status === 'error');
    } finally {
      jobs.delete(songId);
      for (const listener of job.listeners) listener('done');
      for (const listener of finishedListeners) {
        try { listener(songId, succeeded); } catch (error) { console.error('Falha ao acompanhar conclusão da análise', error); }
      }
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
