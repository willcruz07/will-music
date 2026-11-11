import { chordNotes } from '../lib/chordNotation.ts';
import { type Center, type Chord, chordName } from './harmony.ts';

export const InversionPicker = ({ chord, center, onChange, title = 'Inversões e baixo', disableCurrent = false }: {
  chord: Chord; center: Center; onChange: (bass: number | undefined) => void; title?: string; disableCurrent?: boolean;
}) => {
  const base = { ...chord, bass: undefined };
  const pcs = chordNotes(chordName(base, center)) ?? [];
  return <section className="rounded-xl border border-border bg-background/60 p-3" aria-label={title}>
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="mt-1 text-xs text-muted-foreground">Mesmas notas, outra nota no baixo. Selecione a cifra para usar essa posição.</p>
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Posições de ${chordName(base, center)}`}>
      {pcs.map((pc, index) => {
        const bass = pc === chord.root ? undefined : pc;
        const name = chordName({ ...base, bass }, center);
        const active = (chord.bass ?? chord.root) === pc;
        const label = index === 0 ? 'Estado fundamental' : index <= 3 ? `${index}ª inversão` : 'Baixo na extensão';
        return <button key={pc} type="button" aria-label={`${name}, ${label}`} aria-pressed={active} disabled={disableCurrent && active} onClick={() => onChange(bass)} className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-default ${active ? 'border-primary bg-primary/15 text-chord' : 'border-border hover:border-primary/60'}`}><strong className="block">{name}</strong><span className="block text-[11px] text-muted-foreground">{label}</span></button>;
      })}
    </div>
  </section>;
};
