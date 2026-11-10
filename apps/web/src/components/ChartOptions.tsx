import { Minus, Pencil, Plus } from 'lucide-react';
import { useState, type RefObject } from 'react';
import type { Chart, Song } from '../lib/db.ts';
import { Button, IconButton } from '../ui/Button.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';
import { AddToSetlist } from './AddToSetlist.tsx';
import { PrintChartButton } from './PrintChartButton.tsx';

export const ChartOptions = ({ chart, song, shownKey, content, onPatch, onEdit, disabled = false }: {
  chart: Chart; song: Song; shownKey?: string; content: RefObject<HTMLElement | null>;
  onPatch: (patch: Partial<Chart>) => Promise<void>; onEdit: (text: string) => Promise<void>; disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [initial, setInitial] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const patch = async (value: Partial<Chart>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await onPatch(value); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível atualizar a cifra.'); }
    finally { setBusy(false); }
  };
  const close = () => {
    if (busy) return;
    if (draft === initial) { setOpen(false); return; }
    void confirmDialog({ title: 'Descartar alterações?', message: 'O texto editado ainda não foi salvo.', confirmLabel: 'Descartar', cancelLabel: 'Continuar editando' }).then(ok => { if (ok) setOpen(false); });
  };
  return <section role="toolbar" aria-label="Ferramentas da música" className="mt-5 space-y-4 rounded-2xl border border-border bg-surface/60 p-4">
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="flex items-center gap-2"><span className="mr-1 text-sm text-muted-foreground">Transpor</span><IconButton label="Meio tom abaixo" disabled={disabled || busy} onClick={() => void patch({ transpose: chart.transpose - 1 })}><Minus className="size-4" /></IconButton><span className="min-w-12 text-center font-semibold text-chord">{shownKey ?? `${chart.transpose > 0 ? '+' : ''}${chart.transpose}`}</span><IconButton label="Meio tom acima" disabled={disabled || busy} onClick={() => void patch({ transpose: chart.transpose + 1 })}><Plus className="size-4" /></IconButton></div>
      <div className="flex items-center gap-2"><span className="mr-1 text-sm text-muted-foreground">Letra</span><IconButton label="Diminuir letra" disabled={disabled || busy || chart.fontSize <= 12} onClick={() => void patch({ fontSize: Math.max(12, chart.fontSize - 2) })}><span className="text-sm font-bold">A−</span></IconButton><span className="min-w-10 text-center text-sm tabular-nums">{chart.fontSize}px</span><IconButton label="Aumentar letra" disabled={disabled || busy || chart.fontSize >= 40} onClick={() => void patch({ fontSize: Math.min(40, chart.fontSize + 2) })}><span className="text-lg font-bold">A+</span></IconButton></div>
    </div>
    <div className="flex flex-wrap items-start gap-2 border-t border-border pt-3"><Button disabled={disabled || busy} onClick={() => { setDraft(chart.chordPro); setInitial(chart.chordPro); setEditError(null); setOpen(true); }}><Pencil className="size-4" /> Editar letra e cifra</Button><AddToSetlist songId={song.id} disabled={disabled || busy} /><PrintChartButton content={content} title={song.title} artist={song.artist} /></div>
    {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    {open && <BottomSheet title="Editar letra e cifra" onClose={close} size="wide" initialFocus={panel => panel.querySelector('textarea')}>{() => <form className="space-y-3 overflow-auto px-4 pb-5" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setEditError(null); void onEdit(draft).then(() => setOpen(false)).catch(e => setEditError(e instanceof Error ? e.message : 'Não foi possível salvar. O texto foi mantido.')).finally(() => setBusy(false)); }}>
      <p className="text-sm text-muted-foreground">Escreva os acordes entre colchetes: [G]letra da música [D].</p>
      {chart.transpose !== 0 && <p className="text-xs text-muted-foreground">O texto está no tom original; a transposição de {chart.transpose > 0 ? '+' : ''}{chart.transpose} semitons é aplicada na leitura.</p>}
      <textarea aria-label="Cifra em ChordPro" value={draft} onChange={e => setDraft(e.target.value)} disabled={busy} spellCheck={false} className="h-[42dvh] w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-base" />
      {editError && <p role="alert" className="text-sm text-danger">{editError}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={close}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</Button></div>
    </form>}</BottomSheet>}
  </section>;
};
