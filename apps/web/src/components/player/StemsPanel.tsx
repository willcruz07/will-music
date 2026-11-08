import type { StemMode } from '@will-music/engine';
import { Download, Layers, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes, requestPersistence, storageStatus } from '../../lib/storage.ts';
import { downloadBlob } from '../../lib/download.ts';
import { MODE_INFO, availableModes } from '../../lib/stems.ts';
import type { StemsState } from '../../lib/useStems.ts';
import { Button } from '../../ui/Button.tsx';
import { confirmDialog } from '../../ui/Dialog.tsx';
import { Mixer } from '../Mixer.tsx';

const mb = (n: number) => Math.round(n / 1e6);

/** How much this site may still store, and the button to ask the browser to keep the data. */
const StorageNote = () => {
  const [status, setStatus] = useState<{ usage?: number; quota?: number; persisted: boolean } | null>(null);
  const refresh = () => void storageStatus().then(setStatus);
  useEffect(refresh, []);
  if (!status) return null;
  const free = status.quota !== undefined && status.usage !== undefined ? status.quota - status.usage : undefined;
  return (
    <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
      {free !== undefined && (
        <p>
          Espaço livre para o app: <span className="font-semibold text-foreground">{formatBytes(free)}</span> (usando {formatBytes(status.usage!)}).
          {free < 600e6 && ' Pouco espaço: numa janela anônima o limite é bem menor; use uma janela normal.'}
        </p>
      )}
      {status.persisted ? (
        <p className="mt-0.5">Seus dados estão protegidos: o navegador não apaga as músicas, faixas e modelos sozinho.</p>
      ) : (
        <button type="button" className="mt-1 font-semibold text-chord underline underline-offset-2" onClick={() => void requestPersistence().then(refresh)}>
          Proteger meus dados (pedir ao navegador para não apagar)
        </button>
      )}
    </div>
  );
};

/** Separation types, the running job, the active set's mixer and the MP3 export, all inside the player drawer. */
export const StemsPanel = ({ stems, title, hasAudio }: { stems: StemsState; title: string; hasAudio: boolean }) => {
  const { hasStems, activeMode, modes, mix, setMix, useMix, setUseMix, progress, error, separate, cancel, select, remove, exportMix } = stems;
  const [choosing, setChoosing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!hasAudio) return <p className="text-sm text-muted-foreground">Esta música não tem áudio para separar.</p>;

  if (progress) {
    const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
    return (
      <div role="status" aria-live="polite">
        <p className="text-sm font-semibold">
          {MODE_INFO[progress.mode].label}:{' '}
          {progress.stage === 'models' ? `baixando o modelo (${mb(progress.done)} de ${mb(progress.total)} MB)` : `separando (${progress.done} de ${progress.total})`}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Pode continuar tocando e lendo a cifra. Se sair desta tela, a separação para.</p>
        <Button variant="ghost" className="mt-1" onClick={cancel}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    );
  }

  const chooser = (
    <ul className="grid gap-2 sm:grid-cols-2">
      {availableModes().map((mode: StemMode) => {
        const info = MODE_INFO[mode];
        const done = modes.includes(mode);
        return (
          <li key={mode}>
            <button
              type="button"
              onClick={() => {
                setChoosing(false);
                if (done) void select(mode);
                else void separate(mode);
              }}
              className={`h-full w-full rounded-xl border p-3 text-left transition-colors hover:border-primary ${mode === activeMode ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
            >
              <span className="flex items-center justify-between gap-2 font-semibold">
                {info.label}
                <span className="text-xs font-normal text-muted-foreground">{done ? 'Pronta' : `${mb(info.downloadBytes)} MB na primeira vez`}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{info.description}</span>
              {!done && <span className="mt-1 block text-xs text-muted-foreground">Leva {info.effort}.</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      {error && (
        <p className="mb-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {!hasStems || choosing ? (
        <>
          <p className="mb-2 text-sm text-muted-foreground">Escolha como separar. Cada tipo baixa o modelo uma vez e fica guardado no aparelho. Precisa de Chrome ou Edge com WebGPU.</p>
          {chooser}
          <StorageNote />
          {hasStems && (
            <Button variant="ghost" className="mt-2" onClick={() => setChoosing(false)}>
              Voltar ao mixer
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useMix} onChange={(e) => setUseMix(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Tocar pelas faixas
            </label>
            <span className="flex-1" />
            <Button variant="outline" className="min-h-9 px-3" onClick={() => setChoosing(true)}>
              <Layers className="size-4" /> {activeMode ? MODE_INFO[activeMode].label : 'Tipo'}
            </Button>
          </div>
          <div className={useMix ? '' : 'pointer-events-none opacity-50'}>
            <Mixer tracks={mix} onChange={setMix} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!!exporting}
              onClick={() => {
                setExportError(null);
                setExporting('Preparando');
                void exportMix(setExporting)
                  .then((blob) => downloadBlob(blob, `${title || 'música'} (mixagem).mp3`))
                  .catch((e: unknown) => setExportError(e instanceof Error ? e.message : 'Não foi possível salvar o MP3.'))
                  .finally(() => setExporting(null));
              }}
            >
              <Download className="size-4" /> {exporting ?? 'Salvar mixagem em MP3'}
            </Button>
            <Button
              variant="ghost"
              className="text-danger"
              onClick={() =>
                activeMode &&
                void confirmDialog({ title: 'Apagar a separação?', message: `A separação "${MODE_INFO[activeMode].label}" desta música sai do aparelho. Dá para separar de novo depois.`, confirmLabel: 'Apagar' }).then((ok) => {
                  if (ok) void remove();
                })
              }
            >
              <Trash2 className="size-4" /> Apagar esta separação
            </Button>
          </div>
          {exportError && (
            <p className="mt-2 text-sm text-danger" role="alert">
              {exportError}
            </p>
          )}
        </>
      )}
    </div>
  );
};
