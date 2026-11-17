import { ArrowLeft, Copy, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { SheetStudy } from '../components/sheet/SheetStudy.tsx';
import type { Sheet } from '../lib/sheet/model.ts';
import { copySharedSheet, getSheet, type SharedSheetRecord } from '../lib/sheet/store.ts';
import { Button } from '../ui/Button.tsx';

const Header = ({ title, subtitle, back }: { title: string; subtitle?: string; back: { to: string; label: string } }) => (
  <>
    <Link to={back.to} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" /> {back.label}</Link>
    <h1 className="mt-2 break-words font-[family-name:var(--font-display)] text-3xl font-semibold">{title}</h1>
    {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
  </>
);

/** Study mode of a score of the musician's own library. */
export const SheetStudyPage = () => {
  const { id = '' } = useParams();
  const [sheet, setSheet] = useState<Sheet | null | undefined>(undefined);
  useEffect(() => { void getSheet(id).then((s) => setSheet(s ?? null)); }, [id]);
  if (sheet === undefined) return <p role="status" className="mt-6 animate-pulse text-muted-foreground">Abrindo a partitura…</p>;
  if (!sheet) return <p className="mt-6">Esta partitura não está neste aparelho.</p>;
  return (
    <section className="pb-6">
      <Header title={sheet.title} subtitle={[sheet.author, sheet.sharedFrom ? `compartilhada por ${sheet.sharedFrom.ownerName}` : ''].filter(Boolean).join(' · ')} back={{ to: '/?aba=partituras', label: 'Partituras' }} />
      <div className="my-3"><Link to={`/partitura/${sheet.id}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><Pencil className="size-4" /> Editar</Link></div>
      <SheetStudy sheet={sheet} />
    </section>
  );
};

/** A score opened from a teacher's link: study it, and save a copy to edit or keep. */
export const SharedSheetPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<SharedSheetRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void import('../lib/cloud/sheets.ts').then((api) => api.openSharedSheet(id)).then((r) => { if (active) setRecord(r); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Não foi possível abrir a partitura.'); });
    return () => { active = false; };
  }, [id]);
  if (error) return <section><Header title="Partitura compartilhada" back={{ to: '/?aba=partituras', label: 'Partituras' }} /><p role="alert" className="mt-4">{error}</p></section>;
  if (!record) return <p role="status" className="mt-6 animate-pulse text-muted-foreground">Abrindo a partitura compartilhada…</p>;
  return (
    <section className="pb-6">
      <Header title={record.sheet.title} subtitle={`Compartilhada por ${record.ownerName}${record.sheet.author && record.sheet.author !== record.ownerName ? ` · ${record.sheet.author}` : ''}`} back={{ to: '/?aba=partituras', label: 'Partituras' }} />
      <div className="my-3">
        <Button variant="outline" disabled={saving} onClick={() => { setSaving(true); void copySharedSheet(record).then((copy) => navigate(`/partitura/${copy.id}`)).finally(() => setSaving(false)); }}><Copy className="size-4" /> {saving ? 'Salvando…' : 'Salvar uma cópia para editar'}</Button>
      </div>
      <SheetStudy sheet={record.sheet} />
    </section>
  );
};
