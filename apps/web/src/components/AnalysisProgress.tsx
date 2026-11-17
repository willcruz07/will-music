import { AlertCircle, CheckCircle2, Circle, Loader2, MinusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AnalysisTaskProgress, PipelineProgress } from '../lib/pipeline.ts';

/**
 * A determinate bar that glides between updates (with a light sheen while it works), or a band sweeping across
 * when the amount is unknown. Motion stops under "reduce motion".
 */
export const ProgressBar = ({ fraction, className = 'mt-3 h-2' }: { fraction?: number; className?: string }) => {
  const pct = fraction === undefined ? undefined : Math.round(Math.max(0, Math.min(1, fraction)) * 1000) / 10;
  return (
    <div
      className={`${className} relative overflow-hidden rounded-full bg-muted`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct === undefined ? undefined : Math.round(pct)}
    >
      {pct === undefined ? (
        <div className="progress-sweep absolute inset-y-0 w-2/5 rounded-full bg-primary" />
      ) : (
        <div className="progress-fill relative h-full overflow-hidden rounded-full bg-primary" style={{ width: `${Math.max(pct, 2)}%` }}>
          {pct < 100 && <span className="progress-sheen absolute inset-0" aria-hidden />}
        </div>
      )}
    </div>
  );
};

/** Same step while only its numbers change (bytes, "trecho 3 de 9"): the fade plays once per step. */
const stepKey = (label: string) => label.replace(/[\d.,]+/g, '#');

const TASK_NAMES = { tracks: 'Tracks', chords: 'Acordes e tom', lyrics: 'Letra' } as const;

const TaskIcon = ({ status }: { status: AnalysisTaskProgress['status'] }) => {
  if (status === 'running') return <Loader2 className="size-4 animate-spin text-primary" aria-hidden />;
  if (status === 'done') return <CheckCircle2 className="progress-pop size-4 text-primary" aria-hidden />;
  if (status === 'error') return <AlertCircle className="progress-pop size-4 text-danger" aria-hidden />;
  if (status === 'skipped') return <MinusCircle className="size-4 text-muted-foreground" aria-hidden />;
  return <Circle className="size-4 text-muted-foreground/60" aria-hidden />;
};

export const AnalysisProgress = ({ progress }: { progress: PipelineProgress }) => (
  <div className="mt-10 max-w-md" role="status" aria-live="polite">
    <p key={stepKey(progress.label)} className="progress-fade text-lg font-semibold">{progress.label}</p>
    {progress.tasks ? <div className="mt-3 space-y-3" aria-label="Progresso das tarefas">
      {progress.tasks.map((task) => <div key={task.id} className={`rounded-lg border p-3 transition-colors duration-300 ${task.status === 'running' ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
        <p className="flex items-center gap-2 text-sm font-semibold"><TaskIcon key={task.status} status={task.status} /> {TASK_NAMES[task.id]}</p>
        <p key={stepKey(task.label)} className="progress-fade mt-1 text-sm text-muted-foreground">{task.label}</p>
        {task.status === 'running' && <ProgressBar fraction={task.fraction} className="mt-2 h-1.5" />}
        {task.detail && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{task.detail}</p>}
      </div>)}
    </div> : <><ProgressBar fraction={progress.fraction} />
      {progress.detail && <p className="mt-2 text-sm text-muted-foreground tabular-nums">{progress.detail}</p>}</>}
    <p className="mt-3 text-sm text-muted-foreground">Tudo é processado no seu aparelho. Os modelos necessários são baixados na primeira utilização e reutilizados nas próximas músicas.</p>
  </div>
);

/** "1 min 05 s" style elapsed time. */
export const formatElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
};

/**
 * Sticky bar while the lyrics are transcribed and the chords already show: the step, a bar, the time so far and
 * the latest words heard, so a long transcription reads as working, not frozen.
 */
export const TranscribingBar = ({ progress }: { progress: PipelineProgress }) => {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 mt-4 rounded-xl border border-primary/40 px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        <p key={stepKey(progress.label)} className="progress-fade min-w-0 flex-1 truncate text-sm font-semibold">{progress.label}</p>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" aria-label={`Tempo: ${formatElapsed(now - startedAt)}`}>
          {formatElapsed(now - startedAt)}
        </span>
      </div>
      <ProgressBar fraction={progress.fraction} className="mt-2 h-1.5" />
      <p className="mt-1.5 truncate text-xs text-muted-foreground">
        {progress.detail?.startsWith('“') ? <span className="italic">Ouvindo: {progress.detail}</span>
          : progress.detail ? <span className="tabular-nums">{progress.detail}</span>
          : 'Os acordes já estão prontos; a letra aparece aqui quando a transcrição terminar.'}
      </p>
    </div>
  );
};

const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/12', 'w-4/5', 'w-7/12', 'w-2/3', 'w-1/2'];

/** Placeholder lines where the lyrics will appear. */
export const LyricsSkeleton = () => (
  <div className="mt-6 space-y-4" aria-hidden>
    {WIDTHS.map((w, i) => (
      <div key={i} className="space-y-1.5">
        <div className="h-3 w-10 animate-pulse rounded bg-chord/25" />
        <div className={`h-4 ${w} animate-pulse rounded bg-muted`} />
      </div>
    ))}
  </div>
);
