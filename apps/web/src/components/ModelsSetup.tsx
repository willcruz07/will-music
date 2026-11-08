import { Check, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MODELS } from '@will-music/engine';
import { BASIC_MODELS, downloadModels, missingModels } from '../lib/models.ts';
import { formatBytes } from '../lib/storage.ts';
import { preloadWhisper, whisperCached } from '../lib/whisper.ts';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';

const ASKED_KEY = 'wm-models-asked';
const WHISPER_BYTES = 150 * 1024 * 1024;
const mb = (bytes: number) => formatBytes(bytes);

const ITEMS = [
  { label: 'Acordes e tom', about: 'para montar a cifra de cada música', bytes: MODELS.chordnet.bytes + MODELS.cqtPlan.bytes + MODELS.skey.bytes },
  { label: 'Separar voz e instrumental', about: 'para ouvir e treinar cada parte', bytes: MODELS.kara2Core.bytes + MODELS.kara2Data.bytes },
  { label: 'Transcrição da letra', about: 'quando a letra não é encontrada na internet', bytes: WHISPER_BYTES },
  { label: 'Notas da partitura', about: 'para gerar partituras e tablaturas', bytes: MODELS.basicPitch.bytes },
];
const TOTAL = ITEMS.reduce((n, i) => n + i.bytes, 0);

const asked = () => {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return true;
  }
};
const markAsked = () => {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // storage blocked: the question may come back next time
  }
};

type Phase = { kind: 'ask' } | { kind: 'installing'; label: string; fraction: number } | { kind: 'done' } | { kind: 'error'; message: string };

/**
 * First run: when the basic models are not on the device, ask once whether to install them now (chords and
 * key, voice/instrumental separation, lyrics transcription, score notes), with sizes and progress.
 */
export const ModelsSetup = () => {
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    if (asked()) return;
    let alive = true;
    let timer = 0;
    // Wait for any other sheet (the first-visit "Sobre") to close before asking: one sheet at a time.
    const askWhenFree = () => {
      if (!alive) return;
      if (document.querySelector('[aria-modal="true"]')) timer = window.setTimeout(askWhenFree, 500);
      else setPhase({ kind: 'ask' });
    };
    void Promise.all([missingModels(BASIC_MODELS), whisperCached()])
      .then(([missing, whisper]) => {
        if (missing.length > 0 || !whisper) askWhenFree();
      })
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  if (!phase) return null;
  const close = () => {
    markAsked();
    setPhase(null);
  };

  const install = async () => {
    setPhase({ kind: 'installing', label: 'Baixando os modelos de análise', fraction: 0 });
    try {
      await downloadModels(BASIC_MODELS, (done, total) => setPhase({ kind: 'installing', label: `Baixando os modelos de análise (${mb(done)} de ${mb(total)})`, fraction: total ? (done / total) * 0.6 : 0.6 }));
      await preloadWhisper((done, total) =>
        setPhase({ kind: 'installing', label: `Baixando o modelo da letra (${mb(done)}${total ? ` de ${mb(total)}` : ''})`, fraction: 0.6 + (total ? (done / total) * 0.4 : 0) }),
      );
      markAsked();
      setPhase({ kind: 'done' });
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'O download falhou.' });
    }
  };

  const installing = phase.kind === 'installing';
  return (
    <BottomSheet title="Preparar o will-music" onClose={() => !installing && close()}>
      {() => (
        <div className="overflow-y-auto overscroll-contain px-4 pb-5">
          {phase.kind === 'done' ? (
            <div className="py-4 text-center">
              <Check className="mx-auto size-10 text-primary" />
              <p className="mt-2 text-lg font-semibold">Tudo pronto!</p>
              <p className="mt-1 text-sm text-muted-foreground">Os modelos ficam no aparelho: a análise funciona até sem internet.</p>
              <Button className="mt-4 w-full" onClick={() => setPhase(null)}>
                Começar
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Para analisar músicas, o app usa modelos de inteligência artificial que rodam no seu aparelho. Instale os básicos agora (cerca de {mb(TOTAL)}, melhor no Wi-Fi):
              </p>
              <ul className="mt-3 space-y-2">
                {ITEMS.map((i) => (
                  <li key={i.label} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3">
                    <span className="min-w-0">
                      <span className="block font-semibold">{i.label}</span>
                      <span className="block text-xs text-muted-foreground">{i.about}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{mb(i.bytes)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">A separação em 4 e 6 faixas é opcional e fica em Ajustes.</p>
              {installing && (
                <div className="mt-4" role="status">
                  <p className="text-sm">{phase.label}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(phase.fraction * 100)}%` }} />
                  </div>
                </div>
              )}
              {phase.kind === 'error' && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {phase.message} Tente de novo; o que já foi baixado não se perde.
                </p>
              )}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="min-h-11" disabled={installing} onClick={close}>
                  Depois
                </Button>
                <Button className="min-h-11" disabled={installing} onClick={() => void install()}>
                  <Download className="size-4" /> {phase.kind === 'error' ? 'Tentar de novo' : 'Instalar agora'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
