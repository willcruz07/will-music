import { AlertCircle, Check, type LucideIcon } from 'lucide-react';

export type TabActivity = { status: 'idle' | 'waiting' | 'running' | 'done' | 'error'; fraction?: number };

const R = 13;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * A studio tab's icon that tells how its part of the analysis is going: a ring that fills (or spins when the amount
 * is unknown) while it processes, a faint dashed ring while it waits its turn, and a check badge when it is ready.
 */
export const StudioTabIcon = ({ icon: Icon, activity }: { icon: LucideIcon; activity: TabActivity }) => {
  const { status, fraction } = activity;
  const busy = status === 'running' || status === 'waiting';
  return (
    <span className="relative inline-flex size-7 shrink-0 items-center justify-center">
      {busy && (
        <svg className={`absolute inset-0 size-7 -rotate-90 ${status === 'running' && fraction === undefined ? 'tab-ring-spin' : ''}`} viewBox="0 0 30 30" aria-hidden>
          <circle cx="15" cy="15" r={R} fill="none" strokeWidth="2" className="stroke-current opacity-15" strokeDasharray={status === 'waiting' ? '2 4' : undefined} />
          {status === 'running' && (
            <circle
              cx="15" cy="15" r={R} fill="none" strokeWidth="2.25" strokeLinecap="round"
              className="tab-ring-fill stroke-[var(--primary)]"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={fraction === undefined ? CIRCUMFERENCE * 0.72 : CIRCUMFERENCE * (1 - Math.max(0.04, Math.min(1, fraction)))}
            />
          )}
        </svg>
      )}
      <Icon className={`size-4 ${status === 'running' ? 'tab-icon-breathe' : ''}`} aria-hidden />
      {status === 'done' && (
        <span className="progress-pop absolute -right-1 -top-1 inline-flex size-3.5 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] ring-2 ring-[var(--surface)]" aria-hidden>
          <Check className="size-2.5" strokeWidth={3.5} />
        </span>
      )}
      {status === 'error' && <AlertCircle className="progress-pop absolute -right-1 -top-1 size-3.5 rounded-full bg-[var(--surface)] text-danger" aria-hidden />}
    </span>
  );
};

export const ACTIVITY_WORD: Record<TabActivity['status'], string> = { idle: '', waiting: 'na fila', running: 'processando', done: 'pronto', error: 'não terminou' };
