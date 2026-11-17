import { FilePlus2, GraduationCap, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { type Sheet, SOUND_LABELS } from '../../lib/sheet/model.ts';
import { listSharedSheets, listSheets, type SharedSheetRecord } from '../../lib/sheet/store.ts';

const kind = (sheet: Sheet) => (sheet.staffType === 'piano' ? 'Piano' : sheet.staffType === 'drums' ? 'Bateria' : SOUND_LABELS[sheet.sound]);
const meter = (sheet: Sheet) => `${sheet.timeSignature.beats}/${sheet.timeSignature.unit}`;

/** Written scores of this device and the ones opened from a teacher's link, with the button to start a new one. */
export const SheetLibrary = ({ query = '' }: { query?: string }) => {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [shared, setShared] = useState<SharedSheetRecord[]>([]);
  useEffect(() => { void Promise.all([listSheets(), listSharedSheets()]).then(([a, b]) => { setSheets(a); setShared(b); }); }, []);
  const fold = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const match = (t: string) => !query.trim() || fold(t).includes(fold(query.trim()));
  const mine = sheets.filter((s) => match(`${s.title} ${s.author}`));
  const others = shared.filter((r) => match(`${r.sheet.title} ${r.ownerName}`));
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Partituras escritas</h2>
        <span className="flex-1" />
        <Link to="/partitura/nova" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><FilePlus2 className="size-4" /> Nova partitura</Link>
      </div>
      {mine.length === 0 && others.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Escreva exercícios e músicas para seus alunos: uma pauta, piano ou bateria, com sons de instrumento para estudar.</p>}
      {mine.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {mine.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3">
              <Link to={`/partitura/${s.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="truncate text-xs text-muted-foreground">{kind(s)} · {meter(s)} · {s.staves[0]!.measures.length} compassos{s.shared ? ' · compartilhada' : ''}</p>
              </Link>
              {s.shared && <Share2 aria-label="Compartilhada" className="size-4 text-chord" />}
              <Link to={`/partitura/${s.id}/estudar`} aria-label={`Estudar ${s.title}`} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border"><GraduationCap className="size-4" /></Link>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && <>
        <h3 className="mt-4 text-sm font-semibold">Compartilhadas comigo</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {others.map((r) => (
            <li key={r.id}><Link to={`/partitura/compartilhada/${r.id}`} className="block rounded-xl border border-border bg-surface p-3">
              <p className="truncate font-semibold">{r.sheet.title}</p>
              <p className="truncate text-xs text-muted-foreground">de {r.ownerName} · {kind(r.sheet)}</p>
            </Link></li>
          ))}
        </ul>
      </>}
      <h2 className="mt-6 text-lg font-semibold">Partituras geradas das músicas</h2>
    </div>
  );
};
