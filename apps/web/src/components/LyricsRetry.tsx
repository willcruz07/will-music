import { RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LyricsRetryStatus } from '../lib/lyricsRetry.ts';
import { isMobileStudio } from '../lib/studioDevice.ts';
import { Button } from '../ui/Button.tsx';
import { ProgressBar } from './AnalysisProgress.tsx';

/** "Carregar a letra novamente" inside the lyrics tab, with its own progress and cancel. */
export const LyricsRetry = ({ songId, reason, onLoaded }: { songId: string; reason: string; onLoaded: () => Promise<unknown> | void }) => {
  const [status, setStatus] = useState<LyricsRetryStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const busy = !!status;
  const start = () => {
    const c = new AbortController();
    controller.current = c;
    setMessage(null);
    setStatus({ label: 'Preparando…' });
    void import('../lib/lyricsRetry.ts')
      .then((m) => m.loadLyricsAgain(songId, setStatus, c.signal))
      .then(async (label) => {
        if (c.signal.aborted) return;
        if (!label) { setMessage('Não encontramos a letra desta música. Você pode escrevê-la em "Editar letra e cifra".'); return; }
        await onLoaded();
      })
      .catch((e: unknown) => { if (!c.signal.aborted) setMessage(e instanceof Error ? e.message : 'Não foi possível carregar a letra.'); })
      .finally(() => { if (controller.current === c) { controller.current = null; setStatus(null); } });
  };
  const cancel = () => { controller.current?.abort(); controller.current = null; setStatus(null); setMessage('Carregamento da letra cancelado.'); };
  return (
    <div className="progress-fade mt-5 rounded-xl border border-border bg-surface p-4" role="status" aria-live="polite">
      {busy ? <>
        <p key={status.label.replace(/[\d.,]+/g, '#')} className="progress-fade text-sm font-semibold">{status.label}</p>
        <ProgressBar fraction={status.fraction} className="mt-2 h-1.5" />
        {status.detail && <p className="mt-1 truncate text-xs italic text-muted-foreground">{status.detail}</p>}
        <Button variant="ghost" className="mt-2" onClick={cancel}><X className="size-4" /> Cancelar</Button>
      </> : <>
        <p className="text-sm text-muted-foreground">{message ?? reason}</p>
        <Button variant="outline" className="mt-3" onClick={start}><RotateCcw className="size-4" /> Carregar a letra novamente</Button>
        <p className="mt-2 text-xs text-muted-foreground">{isMobileStudio() ? 'Busca no LRCLIB pelo nome da música e do artista.' : 'Busca no LRCLIB e sincroniza com a voz; sem texto encontrado, transcreve.'}</p>
      </>}
    </div>
  );
};
