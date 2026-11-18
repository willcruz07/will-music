import { AlertCircle, CheckCircle2, Circle, Loader2, MinusCircle, X } from 'lucide-react';
import { Button } from '../ui/Button.tsx';
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

/** In the order they finish: what each step unlocks for the musician. */
const STEPS: { id: AnalysisTaskProgress['id']; name: string; unlocks: string }[] = [
  { id: 'chords', name: 'Acordes e tom', unlocks: 'A cifra aparece assim que esta etapa termina.' },
  { id: 'tracks', name: 'Faixas', unlocks: 'Mixer por instrumento e a voz isolada para a letra.' },
  { id: 'lyrics', name: 'Letra', unlocks: 'Letra sincronizada com a música.' },
];

const TaskIcon = ({ status }: { status: AnalysisTaskProgress['status'] }) => {
  if (status === 'running') return <Loader2 className="size-4 animate-spin text-primary" aria-hidden />;
  if (status === 'done') return <CheckCircle2 className="progress-pop size-4 text-primary" aria-hidden />;
  if (status === 'error') return <AlertCircle className="progress-pop size-4 text-danger" aria-hidden />;
  if (status === 'skipped') return <MinusCircle className="size-4 text-muted-foreground" aria-hidden />;
  return <Circle className="size-4 text-muted-foreground/60" aria-hidden />;
};

const STATUS_WORD: Record<AnalysisTaskProgress['status'], string> = { running: 'em andamento', done: 'concluída', error: 'com erro', skipped: 'pulada', waiting: 'na fila' };

/** Seconds since the component mounted, ticking once a second. */
const useElapsed = () => {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now - startedAt;
};

export const AnalysisProgress = ({ progress, onCancel }: { progress: PipelineProgress; onCancel?: () => void }) => {
  const elapsed = useElapsed();
  const tasks = progress.tasks ? STEPS.map((step) => ({ step, task: progress.tasks!.find((t) => t.id === step.id) })).filter((x) => x.task) : [];
  return (
    <div className="mt-8 max-w-md" role="status" aria-live="polite">
      <div className="flex items-baseline gap-3">
        <p key={stepKey(progress.label)} className="progress-fade min-w-0 flex-1 text-lg font-semibold">{progress.label}</p>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums" aria-label={`Tempo decorrido: ${formatElapsed(elapsed)}`}>{formatElapsed(elapsed)}</span>
      </div>
      {tasks.length ? <ol className="relative mt-4 space-y-3" aria-label="Etapas da análise">
        {tasks.map(({ step, task }, i) => {
          const t = task!;
          const active = t.status === 'running';
          return (
            <li key={step.id} className={`relative rounded-xl border p-3 transition-colors duration-300 ${active ? 'border-primary/50 bg-primary/5' : 'border-border'} ${t.status === 'waiting' ? 'opacity-75' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground tabular-nums" aria-hidden>{i + 1}</span>
                <TaskIcon key={t.status} status={t.status} />
                <p className="text-sm font-semibold">{step.name}</p>
                <span className="sr-only">: {STATUS_WORD[t.status]}</span>
              </div>
              <p key={stepKey(t.label)} className="progress-fade mt-1 text-sm text-muted-foreground">{t.label}</p>
              {active && <ProgressBar fraction={t.fraction} className="mt-2 h-1.5" />}
              {t.detail && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{t.detail}</p>}
              {(t.status === 'waiting' || active) && <p className="mt-1.5 text-xs text-muted-foreground/80">{step.unlocks}</p>}
            </li>
          );
        })}
      </ol> : <><ProgressBar fraction={progress.fraction} />
        {progress.detail && <p className="mt-2 text-sm text-muted-foreground tabular-nums">{progress.detail}</p>}</>}
      <p className="mt-3 text-sm text-muted-foreground">Tudo é processado neste aparelho. Os modelos são baixados só na primeira vez e reaproveitados nas próximas músicas.</p>
      {onCancel && <Button variant="ghost" className="mt-2" onClick={onCancel}><X className="size-4" /> Cancelar análise</Button>}
    </div>
  );
};

/** "1 min 05 s" style elapsed time. */
export const formatElapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
};

/**
 * Sticky bar while the lyrics are transcribed and the chords already show: the step, a bar, the time so far and
 * the latest words heard, so a long transcription reads as working, not frozen.
 */
export const TranscribingBar = ({ progress, onCancel }: { progress: PipelineProgress; onCancel?: () => void }) => {
  const elapsed = useElapsed();
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 mt-4 rounded-xl border border-primary/40 px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        <p key={stepKey(progress.label)} className="progress-fade min-w-0 flex-1 truncate text-sm font-semibold">{progress.label}</p>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" aria-label={`Tempo: ${formatElapsed(elapsed)}`}>
          {formatElapsed(elapsed)}
        </span>
        {onCancel && <button type="button" onClick={onCancel} aria-label="Cancelar análise" className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button>}
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
