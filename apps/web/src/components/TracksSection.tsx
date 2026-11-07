import { Layers } from 'lucide-react';
import type { useStems } from '../lib/useStems.ts';
import { Button } from '../ui/Button.tsx';
import { Mixer } from './Mixer.tsx';

const mb = (n: number) => Math.round(n / 1e6);

export const TracksSection = ({ stems }: { stems: ReturnType<typeof useStems> }) => {
  const { hasStems, mix, setMix, useMix, setUseMix, progress, error, separate, remove } = stems;
  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="text-lg font-semibold">Faixas</h2>
      {!hasStems && !progress && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Separa a música em instrumental, voz principal e backing vocals para estudar cada parte. Na primeira vez baixa cerca de 240 MB e precisa de Chrome ou Edge com WebGPU. Pode levar alguns minutos.
          </p>
          <Button className="mt-3" variant="outline" onClick={() => void separate()}>
            <Layers className="size-4" /> Separar faixas
          </Button>
        </>
      )}
      {progress && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="font-semibold">
            {progress.stage === 'models' ? `Baixando o modelo de separação (${mb(progress.done)} MB de ${mb(progress.total)} MB)` : `Separando as faixas (${progress.done} de ${progress.total})`}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {hasStems && (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useMix} onChange={(e) => setUseMix(e.target.checked)} className="accent-[var(--primary)]" />
            Tocar pelas faixas separadas (desmarque para ouvir a música original)
          </label>
          <div className={useMix ? '' : 'pointer-events-none opacity-50'}>
            <Mixer tracks={mix} onChange={setMix} />
          </div>
          <Button variant="ghost" className="mt-2 text-danger" onClick={() => confirm('Apagar as faixas separadas desta música?') && void remove()}>
            Apagar faixas
          </Button>
        </>
      )}
    </section>
  );
};
