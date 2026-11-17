import type { ChordSegment, KeyResult } from '@will-music/engine';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAccount } from '../../lib/account.ts';
import type { ScoreRecord, Song } from '../../lib/db.ts';
import type { ScoreType } from '../../lib/score.ts';
import { BottomSheet } from '../../ui/BottomSheet.tsx';
import { Button } from '../../ui/Button.tsx';

const EDITABLE: Partial<Record<ScoreType, 'melody' | 'keys' | 'drums'>> = { melody: 'melody', keys: 'keys', drums: 'drums' };

/** "Editar" for an AI-made part: asks for the span of measures and opens it in the score editor. */
export const EditScoreButton = ({ type, song, analysis, score }: { type: ScoreType; song: Pick<Song, 'id' | 'title' | 'artist'>; analysis?: { key: KeyResult; chords: ChordSegment[] }; score?: ScoreRecord }) => {
  const navigate = useNavigate();
  const { user } = useAccount();
  const editable = EDITABLE[type];
  const [range, setRange] = useState<{ from: number; to: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!editable || !score) return null;
  const open = () => {
    setError(null);
    void import('../../lib/sheet/fromScore.ts').then((m) => {
      const r = m.suggestedRange(editable, analysis, score);
      if (!r) setError('Esta parte ainda não tem notas para editar.'); else setRange(r);
    });
  };
  const create = () => {
    if (!range) return;
    setBusy(true);
    void Promise.all([import('../../lib/sheet/fromScore.ts'), import('../../lib/sheet/store.ts')])
      .then(async ([m, store]) => {
        const sheet = m.scoreToSheet(editable, song, analysis, score, range, user?.name ?? '');
        await store.saveSheet(sheet);
        navigate(`/partitura/${sheet.id}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível abrir no editor.'))
      .finally(() => setBusy(false));
  };
  const measures = range ? range.to - range.from + 1 : 0;
  return (
    <>
      <Button variant="outline" onClick={open}><Pencil className="size-4" /> Editar</Button>
      {error && !range && <span role="alert" className="text-xs text-danger">{error}</span>}
      {range && (
        <BottomSheet title="Editar esta parte" onClose={() => setRange(null)}>
          {() => (
            <div className="space-y-3 px-4 pb-5 text-sm">
              <p className="text-muted-foreground">A parte vira uma partitura escrita que você pode corrigir: notas, ritmo, acentos e marcações. Escolha o trecho; partes menores ficam mais leves no celular. A música tem {range.total} compassos, em 4/4.</p>
              <div className="flex flex-wrap items-center gap-2">
                <span>Do compasso</span>
                <input aria-label="Compasso inicial" type="number" min={1} max={range.total} value={range.from} onChange={(e) => { const from = Math.max(1, Math.min(range.total, Number(e.target.value) || 1)); setRange({ ...range, from, to: Math.max(from, range.to) }); }} className="min-h-10 w-20 rounded-lg border border-border bg-background px-2" />
                <span>ao</span>
                <input aria-label="Compasso final" type="number" min={range.from} max={range.total} value={range.to} onChange={(e) => setRange({ ...range, to: Math.max(range.from, Math.min(range.total, Number(e.target.value) || range.from)) })} className="min-h-10 w-20 rounded-lg border border-border bg-background px-2" />
              </div>
              {measures > 64 && <p className="text-xs text-muted-foreground">Trechos longos podem ficar lentos para editar no celular.</p>}
              {error && <p role="alert" className="text-danger">{error}</p>}
              <Button disabled={busy} onClick={create}>{busy ? 'Preparando…' : `Abrir ${measures} compassos no editor`}</Button>
            </div>
          )}
        </BottomSheet>
      )}
    </>
  );
};
