import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAccount } from '../lib/account.ts';
import { type Clef, createSheet, type SheetSound, SOUND_LABELS, type StaffType } from '../lib/sheet/model.ts';
import { saveSheet } from '../lib/sheet/store.ts';
import { Button } from '../ui/Button.tsx';

const KEYS: { fifths: number; label: string }[] = [
  { fifths: 0, label: 'Dó maior / Lá menor' }, { fifths: 1, label: 'Sol maior / Mi menor (1♯)' }, { fifths: 2, label: 'Ré maior / Si menor (2♯)' },
  { fifths: 3, label: 'Lá maior / Fá♯ menor (3♯)' }, { fifths: 4, label: 'Mi maior / Dó♯ menor (4♯)' }, { fifths: -1, label: 'Fá maior / Ré menor (1♭)' },
  { fifths: -2, label: 'Si♭ maior / Sol menor (2♭)' }, { fifths: -3, label: 'Mi♭ maior / Dó menor (3♭)' }, { fifths: -4, label: 'Lá♭ maior / Fá menor (4♭)' },
];
const METERS: { beats: number; unit: 2 | 4 | 8; label: string }[] = [
  { beats: 4, unit: 4, label: '4/4' }, { beats: 3, unit: 4, label: '3/4' }, { beats: 2, unit: 4, label: '2/4' }, { beats: 6, unit: 8, label: '6/8' }, { beats: 2, unit: 2, label: '2/2' },
];
const TYPES: { type: StaffType; label: string; hint: string }[] = [
  { type: 'single', label: 'Uma pauta', hint: 'Melodia, voz, violão, flauta, baixo.' },
  { type: 'piano', label: 'Piano', hint: 'Duas pautas: mão direita (sol) e esquerda (fá).' },
  { type: 'drums', label: 'Bateria', hint: 'Bumbo, caixa, chimbal, tons e pratos.' },
];
const option = (active: boolean) => `rounded-xl border p-3 text-left transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-muted'}`;

/** New score: type, sound, key, meter, tempo and size; the score starts with complete measures of rests. */
export const NewSheet = () => {
  const navigate = useNavigate();
  const { user } = useAccount();
  const [type, setType] = useState<StaffType>('single');
  const [sound, setSound] = useState<SheetSound>('melody');
  const [clef, setClef] = useState<Clef>('treble');
  const [keyFifths, setKey] = useState(0);
  const [meter, setMeter] = useState(METERS[0]!);
  const [tempo, setTempo] = useState(80);
  const [measures, setMeasures] = useState(8);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);

  const create = () => {
    setBusy(true);
    const sheet = createSheet({ title, author, staffType: type, sound, clef, keyFifths, timeSignature: { beats: meter.beats, unit: meter.unit }, tempo, measures });
    void saveSheet(sheet).then(() => navigate(`/partitura/${sheet.id}`, { replace: true })).finally(() => setBusy(false));
  };

  return (
    <section className="mx-auto max-w-2xl pb-8">
      <Link to="/?aba=partituras" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" /> Partituras</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">Nova partitura</h1>

      <h2 className="mt-6 text-sm font-semibold">Tipo</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {TYPES.map((t) => <button key={t.type} type="button" aria-pressed={type === t.type} className={option(type === t.type)} onClick={() => setType(t.type)}><span className="font-semibold">{t.label}</span><span className="mt-1 block text-xs text-muted-foreground">{t.hint}</span></button>)}
      </div>

      {type === 'single' && <>
        <h2 className="mt-5 text-sm font-semibold">Som e clave</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['melody', 'piano', 'guitar', 'bass'] as SheetSound[]).map((s) => <button key={s} type="button" aria-pressed={sound === s} className={option(sound === s)} onClick={() => { setSound(s); setClef(s === 'bass' ? 'bass' : 'treble'); }}>{SOUND_LABELS[s]}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['treble', 'bass'] as Clef[]).map((c) => <button key={c} type="button" aria-pressed={clef === c} className={option(clef === c)} onClick={() => setClef(c)}>{c === 'treble' ? 'Clave de sol' : 'Clave de fá'}</button>)}
        </div>
        {(sound === 'guitar' || sound === 'bass') && <p className="mt-2 text-xs text-muted-foreground">Violão e baixo são escritos uma oitava acima do som; a clave aparece com um 8 embaixo e a reprodução segue essa leitura.</p>}
      </>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {type !== 'drums' && <label className="text-sm font-semibold">Tom
          <select value={keyFifths} onChange={(e) => setKey(Number(e.target.value))} className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal">
            {KEYS.map((k) => <option key={k.fifths} value={k.fifths}>{k.label}</option>)}
          </select>
        </label>}
        <div className="text-sm font-semibold">Compasso
          <div className="mt-1 flex flex-wrap gap-1.5">{METERS.map((m) => <button key={m.label} type="button" aria-pressed={meter === m} className={`${option(meter === m)} min-w-14 py-2 text-center`} onClick={() => setMeter(m)}>{m.label}</button>)}</div>
        </div>
        <label className="text-sm font-semibold">Andamento: {tempo} BPM
          <input type="range" min={40} max={200} step={2} value={tempo} onChange={(e) => setTempo(Number(e.target.value))} className="mt-2 block w-full accent-primary" />
        </label>
        <label className="text-sm font-semibold">Compassos
          <input type="number" min={1} max={200} value={measures} onChange={(e) => setMeasures(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Exercício de leitura 1" className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">Professor(a)
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" />
        </label>
      </div>

      <Button className="mt-6" disabled={busy} onClick={create}>{busy ? 'Criando…' : 'Criar e começar a escrever'}</Button>
    </section>
  );
};
