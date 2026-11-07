import type { PipelineProgress } from '../lib/pipeline.ts';

export const AnalysisProgress = ({ progress }: { progress: PipelineProgress }) => (
  <div className="mt-10 max-w-md" role="status" aria-live="polite">
    <p className="text-lg font-semibold">{progress.label}</p>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
      {progress.fraction === undefined ? (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      ) : (
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
      )}
    </div>
    <p className="mt-3 text-sm text-muted-foreground">Tudo é processado no seu aparelho. Na primeira vez, os modelos (cerca de 17 MB) são baixados e ficam guardados.</p>
  </div>
);
