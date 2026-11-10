import { AlertTriangle, Check, Download, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MODELS, type ModelId } from '@will-music/engine';
import { CHORD_MODELS, downloadModels, missingModels } from '../lib/models.ts';
import { MODELS_CHANGED, neverRemind, reminderDue, reminderWait, snoozeReminder } from '../lib/modelsReminder.ts';
import { formatBytes } from '../lib/storage.ts';
import { WHISPER_BYTES, detectWhisperDevice, preloadWhisper, whisperCached } from '../lib/whisper.ts';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';
import { StorageProtection } from './StorageProtection.tsx';

const ASKED_KEY = 'wm-models-asked';
const mb = (bytes: number) => formatBytes(bytes);
const sum = (ids: ModelId[]) => ids.reduce((n, id) => n + MODELS[id].bytes, 0);

type ItemId = 'chords' | 'split' | 'lyrics' | 'notes';
type Item = { id: ItemId; label: string; about: string; models: ModelId[] | 'whisper' };

// The lyrics model depends on the device (lighter where there is no WebGPU); its size shows the larger one until known.
const ITEMS: Item[] = [
  { id: 'chords', label: 'Acordes e tom', about: 'para montar a cifra de cada música', models: CHORD_MODELS },
  { id: 'split', label: 'Separar faixas', about: '6 faixas: voz, bateria, baixo, guitarra, piano e outros', models: ['demucs6s'] },
  { id: 'lyrics', label: 'Transcrição da letra', about: 'para reconhecer a letra a partir da voz da música', models: 'whisper' },
  { id: 'notes', label: 'Notas da partitura', about: 'para gerar partituras e tablaturas', models: ['basicPitch'] },
];
const BASIC = ITEMS;

const itemReady = async (item: Item): Promise<boolean> =>
  item.models === 'whisper' ? whisperCached() : (await missingModels(item.models)).length === 0;

/** Which items are already on the device. */
const readyItems = async (): Promise<Set<ItemId>> => {
  const ready = await Promise.all(ITEMS.map((i) => itemReady(i).catch(() => false)));
  return new Set(ITEMS.filter((_, k) => ready[k]).map((i) => i.id));
};

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

/** Runs `fn` once no other sheet or dialog is open: one modal at a time. */
const whenNoModal = (fn: () => void): (() => void) => {
  let timer = 0;
  const check = () => {
    if (document.querySelector('[aria-modal="true"]')) timer = window.setTimeout(check, 500);
    else fn();
  };
  check();
  return () => clearTimeout(timer);
};

/**
 * The analysis models: on the first run, a sheet asks to install them (with sizes, a check on each one as it
 * lands, including the default 6-track separation). Afterwards, while the basic ones are missing, a red notice floats
 * at the top; closing it offers "Me lembre mais tarde" (it comes back in a day) or "Não me exiba mais".
 */
export const ModelsSetup = () => {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState<Set<ItemId> | null>(null);
  const [badge, setBadge] = useState(false);

  const refresh = useCallback(async () => {
    const r = await readyItems();
    setReady(r);
    return r;
  }, []);

  // First run: ask once, after any other sheet (the first-visit "Sobre" and its thank-you) has closed.
  useEffect(() => {
    let alive = true;
    let stop = () => {};
    void refresh().then((r) => {
      if (!alive || asked() || BASIC.every((i) => r.has(i.id))) return;
      stop = whenNoModal(() => alive && setOpen(true));
    });
    return () => {
      alive = false;
      stop();
    };
  }, [refresh]);

  // Downloads elsewhere (Ajustes) or removals update the notice.
  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(MODELS_CHANGED, onChange);
    return () => window.removeEventListener(MODELS_CHANGED, onChange);
  }, [refresh]);

  // The notice: only after the first-run question, while a basic model is missing and it is not snoozed.
  const missingBasic = ready !== null && BASIC.some((i) => !ready.has(i.id));
  useEffect(() => {
    if (!missingBasic || open) {
      setBadge(false);
      return;
    }
    const wait = asked() ? reminderWait() : null;
    if (wait === null) return;
    const timer = window.setTimeout(() => setBadge(reminderDue()), wait);
    return () => clearTimeout(timer);
  }, [missingBasic, open]);

  const dismissBadge = async () => {
    const never = await confirmDialog({
      title: 'Esconder o aviso?',
      message: 'Sem os modelos, o app não monta cifras nem separa faixas. Os modelos podem ser baixados a qualquer momento em Ajustes.',
      confirmLabel: 'Não me exiba mais',
      cancelLabel: 'Me lembre mais tarde',
    });
    if (never) neverRemind();
    else snoozeReminder();
    setBadge(false);
  };

  return (
    <>
      {badge && (
        <div
          role="status"
          className="player-slide fixed inset-x-3 z-30 mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-danger py-1.5 pl-3 pr-1.5 text-white shadow-[0_12px_40px_-16px_rgb(0_0_0/0.6)]"
          style={{ top: 'calc(env(safe-area-inset-top) + 4rem)' }}
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <p className="flex-1 text-sm font-medium">Você não tem os modelos baixados no app.</p>
          <button type="button" className="min-h-9 rounded-lg bg-white/20 px-3 text-sm font-semibold hover:bg-white/30" onClick={() => setOpen(true)}>
            Baixar
          </button>
          <button type="button" aria-label="Fechar aviso" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-white/20" onClick={() => void dismissBadge()}>
            <X className="size-4" />
          </button>
        </div>
      )}
      {open && ready && (
        <SetupSheet
          initialReady={ready}
          onReady={setReady}
          onClose={() => {
            markAsked();
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

type Phase = { kind: 'ask' } | { kind: 'installing'; item: ItemId; label: string; fraction: number } | { kind: 'done' } | { kind: 'error'; message: string };

const SetupSheet = ({ initialReady, onReady, onClose }: { initialReady: Set<ItemId>; onReady: (r: Set<ItemId>) => void; onClose: () => void }) => {
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' });
  const [ready, setReadyState] = useState(initialReady);
  const [whisperBytes, setWhisperBytes] = useState(WHISPER_BYTES.webgpu);
  const confirming = useRef(false);

  useEffect(() => {
    void detectWhisperDevice()
      .then((d) => setWhisperBytes(WHISPER_BYTES[d]))
      .catch(() => {});
  }, []);

  const bytesOf = (item: Item) => (item.models === 'whisper' ? whisperBytes : sum(item.models));
  const pending = ITEMS.filter((i) => !ready.has(i.id));
  const total = pending.reduce((n, i) => n + bytesOf(i), 0);
  const installing = phase.kind === 'installing';
  const missingBasic = BASIC.some((i) => !ready.has(i.id));

  const markReady = (id: ItemId) =>
    setReadyState((r) => {
      const next = new Set(r).add(id);
      onReady(next);
      return next;
    });

  const install = async () => {
    let base = 0;
    try {
      for (const item of pending) {
        const size = bytesOf(item);
        const report = (done: number, all: number) =>
          setPhase({
            kind: 'installing',
            item: item.id,
            label: `${item.label}: ${mb(done)}${all ? ` de ${mb(all)}` : ''}`,
            fraction: total ? (base + (all ? (done / all) * size : 0)) / total : 1,
          });
        report(0, 0);
        if (item.models === 'whisper') await preloadWhisper(report);
        else await downloadModels(item.models, report);
        markReady(item.id);
        base += size;
      }
      setPhase({ kind: 'done' });
    } catch (error) {
      setPhase({ kind: 'error', message: error instanceof Error ? error.message : 'O download falhou.' });
    }
  };

  // Closing with the basic models still missing asks first; "Não" keeps the sheet open.
  const requestClose = async () => {
    if (installing || confirming.current) return;
    if (missingBasic) {
      confirming.current = true;
      const ok = await confirmDialog({
        title: 'Seguir sem os modelos?',
        message: 'Você não baixou os modelos básicos. Tem certeza que deseja seguir sem baixar nada?',
        confirmLabel: 'Sim, seguir',
        cancelLabel: 'Não',
      });
      confirming.current = false;
      if (!ok) return;
      // The red notice comes back later, not right after this answer (unless it was hidden for good).
      if (reminderWait() !== null) snoozeReminder();
    }
    onClose();
  };

  return (
    <BottomSheet title="Preparar o will-music" onClose={() => void requestClose()}>
      {() => (
        <div className="overflow-y-auto overscroll-contain px-4 pb-5">
          {phase.kind === 'done' ? (
            <div className="py-4 text-center">
              <Check className="mx-auto size-10 text-primary" />
              <p className="mt-2 text-lg font-semibold">Tudo pronto!</p>
              <p className="mt-1 text-sm text-muted-foreground">Os modelos ficam no aparelho: a análise funciona até sem internet.</p>
              <Button className="mt-4 w-full" onClick={onClose}>
                Começar
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Para analisar músicas, o app usa modelos de inteligência artificial que rodam no seu aparelho.
                {pending.length > 0 ? ` Instale agora (cerca de ${mb(total)}, melhor no Wi-Fi):` : ' Todos os escolhidos já estão no aparelho.'}
              </p>
              <ul className="mt-3 space-y-2">
                {ITEMS.map((item) => {
                  const done = ready.has(item.id);
                  const busy = phase.kind === 'installing' && phase.item === item.id;
                  return (
                    <li key={item.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${done ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-primary text-primary-foreground' : 'border border-border'}`} aria-hidden>
                          {done ? <Check className="size-4" /> : busy ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
                        </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {item.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">{item.about}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{done ? 'Baixado' : mb(bytesOf(item))}</span>
                    </li>
                  );
                })}
              </ul>
              <StorageProtection />
              {phase.kind === 'installing' && (
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
                <Button variant="outline" className="min-h-11" disabled={installing} onClick={() => void requestClose()}>
                  {pending.length ? 'Depois' : 'Fechar'}
                </Button>
                {pending.length > 0 && (
                  <Button className="min-h-11" disabled={installing} onClick={() => void install()}>
                    <Download className="size-4" /> {phase.kind === 'error' ? 'Tentar de novo' : 'Instalar agora'}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
};
