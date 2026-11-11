import { ArrowLeft, ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ScrollStrip } from '../components/ScrollStrip.tsx';
import { Link, useSearchParams } from 'react-router';
import { ChordDiagram, type Instrument } from '../components/ChordDiagram.tsx';
import { InstrumentToggle, readInstrument } from '../components/ChordPanel.tsx';
import { CHORD_TYPES, INTERVAL_NAMES, KEYS, ROOTS, SCALES, type ScaleKind, SOLFEGE, chordFormation, harmonicField, pcOf, scaleNotes } from '../lib/chordTheory.ts';
import { rovingKeys } from '../lib/a11y.ts';
import { CircleOfFifths, IntervalTrainer, ProgressionCatalog, ScaleExplorer } from '../study/tools.tsx';
import { SheetSelect } from '../ui/SheetSelect.tsx';
import { chordNotes } from '../lib/chordNotation.ts';
import { PlayButton, chordEvents, useStudySynth } from '../study/widgets.tsx';
import { SCALE_CONTEXT } from '../study/scaleContext.ts';

type Tab = 'chords' | 'theory' | 'scales' | 'circle' | 'progressions' | 'fretboard' | 'ear';
/** The tabs, with the name each one has in links (?aba=). */
const TABS: { id: Tab; aba: string; label: string }[] = [
  { id: 'chords', aba: 'acordes', label: 'Acordes' },
  { id: 'theory', aba: 'formacao', label: 'Formação' },
  { id: 'scales', aba: 'escalas', label: 'Escalas e campo harmônico' },
  { id: 'circle', aba: 'ciclo', label: 'Ciclo de quintas e quartas' },
  { id: 'progressions', aba: 'progressoes', label: 'Progressões' },
  { id: 'fretboard', aba: 'braco', label: 'Escalas no braço' },
  { id: 'ear', aba: 'intervalos', label: 'Treino de ouvido' },
];

const solfege = (root: string) => `${SOLFEGE[root[0]!]}${root.length > 1 ? (root[1] === 'b' ? '♭' : '♯') : ''}`;

const SYNONYMS: [RegExp, string][] = [
  [/^(m7b5|m7-5|ø|m7\(5-\))/u, 'm7(b5)'],
  [/^(dim7|º7)/u, '°7'],
  [/^(dim|º)/u, '°'],
  [/^(maj7|M7|7\+)/u, '7M'],
  [/^(aug|5\+)/u, '+'],
  [/^add9/u, '9'],
  [/^sus(?![24])/u, 'sus4'],
];

/**
 * Preserve the full chord, including its bass. Unsupported formulas are never silently simplified.
 */
export const parseStudyChord = (chord: string | null): { root: string; suffix: string; bass?: string } | null => {
  const m = chord ? /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/u.exec(chord.trim()) : null;
  if (!m) return null;
  const root = m[1]!;
  let rest = m[2]!;
  for (const [re, to] of SYNONYMS) if (re.test(rest)) rest = rest.replace(re, to);
  const aliases: Record<string, string> = { m9: 'm7(9)', maj9: '7M(9)', m11: 'm7(9,11)', m13: 'm7(9,11,13)', maj13: '7M(9,11,13)', '7(4)': '7sus4', '74': '7sus4', '+7': '7(#5)', '69': '6(9)' };
  rest = aliases[rest] ?? rest;
  return { root, suffix: rest, ...(m[3] ? { bass: m[3] } : {}) };
};
const parseChord = parseStudyChord;

/** Keyboard of two octaves with the given pitch classes lit (the first one marked as the tonic). */
const ScaleKeyboard = ({ pcs }: { pcs: number[] }) => {
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const BLACK: Record<number, number> = { 1: 0.65, 3: 1.75, 6: 3.6, 8: 4.7, 10: 5.8 };
  const lit = new Set(pcs);
  const tonic = pcs[0];
  const w = 22;
  return (
    <svg viewBox={`0 0 ${14 * w} 96`} className="w-full max-w-xl" role="img" aria-label="Notas da escala no teclado">
      {[0, 1].map((o) =>
        WHITE.map((pc, i) => (
          <rect key={`w${o}${pc}`} x={(o * 7 + i) * w} y={0} width={w - 1} height={94} rx={3} fill={pc === tonic ? 'var(--primary)' : lit.has(pc) ? 'var(--chord)' : 'var(--surface)'} stroke="var(--border)" />
        )),
      )}
      {[0, 1].map((o) =>
        Object.entries(BLACK).map(([pcText, x]) => {
          const pc = Number(pcText);
          return <rect key={`b${o}${pc}`} x={(o * 7 + x) * w} y={0} width={w * 0.62} height={58} rx={2} fill={pc === tonic ? 'var(--primary)' : lit.has(pc) ? 'var(--chord)' : 'var(--foreground)'} stroke="var(--border)" />;
        }),
      )}
    </svg>
  );
};

const Chip = ({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    aria-label={label}
    onClick={onClick}
    className={`min-h-10 rounded-lg border px-3 text-sm transition-colors ${active ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border hover:bg-muted'}`}
  >
    {children}
  </button>
);

/** Dictionary: a chord on the chosen instrument, its other shapes, how it is built, and the grid of related chords. */
const ChordsTab = ({ initial }: { initial: ReturnType<typeof parseStudyChord> }) => {
  const [root, setRoot] = useState(initial?.root ?? 'C');
  const [suffix, setSuffix] = useState(initial?.suffix ?? '');
  const [bass, setBass] = useState(initial?.bass ?? '');
  const [instrument, setInstrument] = useState<Instrument>(readInstrument);
  const [variant, setVariant] = useState(0);
  const [count, setCount] = useState(0);
  const [grid, setGrid] = useState<'roots' | 'types'>('types');
  const [gridLimit, setGridLimit] = useState(12);
  const type = CHORD_TYPES.find((t) => t.suffix === suffix);
  const chord = `${root}${suffix}${bass ? `/${bass}` : ''}`;
  const known = type ? chordFormation(root, suffix) : undefined;
  const formation = { name: chord, notes: known?.notes ?? [], intervals: known?.intervals ?? [] };
  const bassIndex = bass ? formation.notes.findIndex(note => pcOf(note) === pcOf(bass)) : 0;
  const keyboardBass = !bass && instrument === 'teclado' && variant > 0 && known ? formation.notes[variant % formation.notes.length] : undefined;
  const bassExplanation = keyboardBass ? `Nesta inversão do teclado, ${keyboardBass} é a nota mais grave. A fórmula permanece a mesma; apenas a disposição das notas muda.` : !bass || pcOf(bass) === pcOf(root) ? 'Estado fundamental de referência: a fundamental é a nota mais grave. Sem baixo indicado, as posições no instrumento podem usar outras disposições.' : bassIndex > 0
    ? `${bass} é a nota mais grave e pertence ao acorde (${formation.intervals[bassIndex]}). É uma inversão; as notas do acorde permanecem as mesmas.`
    : `${bass} é um baixo externo à fórmula do acorde. É um acorde sobre baixo indicado, não uma inversão simples; essa nota se soma à harmonia.`;
  const pick = (r: string, s: string) => {
    setRoot(r);
    setSuffix(s);
    setBass('');
    setVariant(0);
    setCount(0);
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <InstrumentToggle
          value={instrument}
          onChange={(i) => {
            setInstrument(i);
            setVariant(0);
          }}
        />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Nota</p>
        <div className="mt-1 grid grid-cols-6 gap-1 sm:grid-cols-12" role="radiogroup" onKeyDown={rovingKeys} aria-label="Nota">
          {KEYS.map((r) => (
            <Chip key={r} active={root === r} onClick={() => pick(r, suffix)} label={`${r} (${solfege(r).replace('♭', 'b').replace('♯', '#')})`}>
              <span className="block font-semibold">{r}</span>
              <span className="block text-[10px] leading-none text-muted-foreground">{solfege(r)}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Tipo</p>
        <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" onKeyDown={rovingKeys} aria-label="Tipo">
          {CHORD_TYPES.map((t) => (
            <Chip key={t.suffix} active={suffix === t.suffix} onClick={() => pick(root, t.suffix)} label={t.suffix || 'maior'}>
              {t.suffix || 'maior'}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Inversões</p>
        <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" onKeyDown={rovingKeys} aria-label="Inversões do acorde">
          {formation.notes.map((note, index) => {
            // The diagram engine accepts single accidentals; keep the theoretical spelling in the label.
            const value = /^[A-G][#b]?$/u.test(note) ? note : ROOTS[pcOf(note)]!;
            const label = index === 0 ? 'Estado fundamental' : index <= 3 ? `${index}ª inversão` : `Baixo na ${formation.intervals[index]}`;
            return <Chip key={`${index}-${note}`} active={pcOf(keyboardBass ?? (bass || root)) === pcOf(note)} onClick={() => { setBass(value); setVariant(0); setCount(0); }} label={`${label}: ${root}${suffix}${index ? `/${value}` : ''}`}>
              <span className="block font-semibold">{root}{suffix}{index ? `/${value}` : ''}</span>
              <span className="block text-xs text-muted-foreground">{label} · {note}</span>
            </Chip>;
          })}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Selecione a nota mais grave. A fórmula do acorde permanece a mesma; o desenho e as variações respeitam o baixo escolhido.</p>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Outro baixo</p>
          <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" onKeyDown={rovingKeys} aria-label="Outro baixo">
            <Chip active={!bass} onClick={() => { setBass(''); setVariant(0); setCount(0); }} label="Sem baixo indicado">Sem baixo indicado</Chip>
            {KEYS.map(note => <Chip key={note} active={bass === note} onClick={() => { setBass(note); setVariant(0); setCount(0); }} label={`Baixo ${note} (${solfege(note)})`}>
              <span className="block font-semibold">{note}</span>
              <span className="block text-[10px] leading-none text-muted-foreground">{solfege(note)}</span>
            </Chip>)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Para escolher também um baixo externo à fórmula, como F/G.</p>
        </div>
      </div>

      <div className="grid gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          {chordNotes(chord) ? <ChordDiagram chord={formation.name} instrument={instrument} variant={variant} onVariants={setCount} size="lg" strict /> : <p className="text-sm text-muted-foreground">Fórmula ainda não suportada: {chord}</p>}
          {count > 1 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <button type="button" aria-label="Forma anterior" onClick={() => setVariant((v) => (v - 1 + count) % count)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
                <ChevronLeft className="size-5" />
              </button>
              <span className="tabular-nums text-muted-foreground">
                {instrument === 'teclado' && !bass ? 'Inversão' : 'Forma'} {variant + 1} de {count}
              </span>
              <button type="button" aria-label="Próxima forma" onClick={() => setVariant((v) => (v + 1) % count)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </div>
        <section aria-label={`Formação de ${formation.name}`}>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            {formation.name} <span className="text-base font-normal text-muted-foreground">· {type?.name ?? 'Fórmula fora do catálogo'}</span>
          </h2>
          <p className="mt-2 text-muted-foreground">{type?.about ?? 'A cifra original foi preservada. Escolha um tipo do catálogo para consultar sua fórmula e explicação detalhada.'}</p>
          {known && <p className="mt-3 text-sm text-muted-foreground">{bassExplanation}</p>}
          {known && bass && bassIndex < 0 && <p className="mt-2 text-sm">Nota adicional no baixo: <strong className="text-chord">{bass}</strong>.</p>}
          <ol className="mt-4 flex flex-wrap gap-2">
            {formation.notes.map((note, i) => (
              <li key={i} className="min-w-24 rounded-xl border border-border px-3 py-2">
                <span className="block font-[family-name:var(--font-display)] text-2xl font-semibold text-chord">{note}</span>
                <span className="block text-xs text-muted-foreground">
                  {formation.intervals[i]} · {INTERVAL_NAMES[formation.intervals[i]!] ?? ''}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">
            {known && <>Fórmula: {formation.intervals.join(' – ')}. </>}{instrument === 'teclado' ? 'Com baixo indicado, as variações mantêm essa nota como a mais grave.' : 'As formas respeitam as notas e o baixo solicitado; em acordes extensos a quinta justa pode ser omitida.'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Nem toda fórmula cabe em todas as cordas. Quando não houver uma posição compatível, o app informa a ausência de diagrama. A função do acorde depende do contexto da progressão.</p>
        </section>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Grade de acordes</h2>
          <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" onKeyDown={rovingKeys} aria-label="O que mostrar na grade">
            {(
              [
                ['types', `Todos os tipos de ${root}`],
                ['roots', 'Todas as notas'],
              ] as const
            ).map(([g, label]) => (
              <button key={g} type="button" role="radio" aria-checked={grid === g} aria-label={g === 'roots' ? 'Todas as notas' : 'Todos os tipos'} onClick={() => setGrid(g)} className={`rounded-md px-3 py-1.5 text-sm ${grid === g ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>
                {g === 'roots' ? `Todas as notas (${suffix || 'maior'})` : label}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3" aria-label="Grade de acordes">
          {(grid === 'roots' ? ROOTS.map((r) => [r, suffix] as const) : CHORD_TYPES.map((t) => [root, t.suffix] as const).slice(0, gridLimit)).map(([r, s]) => (
            <li key={`${r}${s}`}>
              <button type="button" onClick={() => pick(r, s)} className={`flex w-full justify-center rounded-xl border p-2 transition-colors hover:border-primary ${r === root && s === suffix ? 'border-primary bg-primary/10' : 'border-border'}`} aria-label={`Ver ${r}${s}${bass ? `/${bass}` : ''}`}>
                <ChordDiagram chord={`${r}${s}${bass ? `/${bass}` : ''}`} instrument={instrument} strict />
              </button>
            </li>
          ))}
        </ul>
        {grid === 'types' && gridLimit < CHORD_TYPES.length && <button type="button" className="mt-3 min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-muted" onClick={() => setGridLimit(limit => limit + 12)}>Mostrar mais acordes ({Math.min(gridLimit, CHORD_TYPES.length)} de {CHORD_TYPES.length})</button>}
      </div>
    </div>
  );
};

/** Short, explicit comparisons; one shared synth prevents overlapping examples. */
const FormationExample = ({ title, suffixes, synth }: { title: string; suffixes: string[]; synth: ReturnType<typeof useStudySynth> }) => {
  const [suffix, setSuffix] = useState(suffixes[0]!);
  const formation = chordFormation('C', suffix);
  const info = CHORD_TYPES.find(type => type.suffix === suffix)!;
  const base = chordFormation('C', suffixes[0]!);
  const added = formation.notes.filter(note => !base.notes.includes(note));
  const removed = base.notes.filter(note => !formation.notes.includes(note));
  const id = `formation-${title}-${suffix}`;
  return <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
    <p className="text-sm font-semibold">{title}</p>
    <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={title} onKeyDown={rovingKeys}>
      {suffixes.map(value => <Chip key={value} active={suffix === value} onClick={() => { synth.stop(); setSuffix(value); }} label={`Comparar C${value}`}>C{value}</Chip>)}
    </div>
    <div className="mt-4 grid items-start gap-4 sm:grid-cols-[auto_1fr]">
      <ChordDiagram chord={formation.name} instrument="teclado" />
      <div aria-live="polite">
        <p className="font-semibold">{info.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{info.about}</p>
        <p className="mt-2 text-sm">Fórmula: {formation.intervals.join(' – ')}</p>
        <p className="mt-1 text-sm">Notas: {formation.notes.map((note, index) => <span key={index} className={added.includes(note) ? 'font-bold text-chord' : ''}>{index > 0 ? ' · ' : ''}{note}</span>)}</p>
        {(added.length > 0 || removed.length > 0) && <p className="mt-2 text-xs text-muted-foreground">Em relação a {base.name}: {removed.length > 0 ? `retira ${removed.join(', ')}. ` : ''}{added.length > 0 ? `acrescenta ${added.join(', ')}.` : ''}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PlayButton active={synth.playing === id} onClick={() => synth.play(id, chordEvents([formation.name], 90, 2))} label={formation.name} />
          <Link className="inline-flex min-h-10 items-center text-sm font-semibold text-chord hover:underline" to={`/estudo/ferramentas?acorde=${encodeURIComponent(formation.name)}`}>Ver formas e inversões</Link>
        </div>
      </div>
    </div>
  </div>;
};

const TheoryTab = () => {
  const synth = useStudySynth();
  return (
  <div className="mt-6 max-w-3xl space-y-8 leading-relaxed">
    <section>
      <h2 className="text-xl font-semibold">Intervalos: a régua da música</h2>
      <p className="mt-2 text-muted-foreground">
        Intervalo é a distância entre duas notas, contada em semitons (cada casa do violão ou cada tecla vizinha do teclado, contando as pretas). Todo acorde é uma pilha de intervalos a
        partir da nota que dá nome a ele, a <em>fundamental</em>.
      </p>
      <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Fundamental não é sinônimo de tônica:</strong> em Dm dentro do tom de Dó maior, Ré é a fundamental do acorde e Dó é a tônica da tonalidade. O baixo é a nota mais grave da formação e também pode ser diferente da fundamental.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 pr-3 font-normal">Intervalo</th>
            <th className="py-1 pr-3 font-normal">Semitons</th>
            <th className="py-1 font-normal">A partir de Dó</th>
            <th className="py-1 pl-2 font-normal">Ouvir</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['2M', 2, 'Ré'],
              ['3m', 3, 'Mi♭'],
              ['3M', 4, 'Mi'],
              ['4J', 5, 'Fá'],
              ['5b', 6, 'Sol♭'],
              ['5J', 7, 'Sol'],
              ['5#', 8, 'Sol♯'],
              ['6M', 9, 'Lá'],
              ['7m', 10, 'Si♭'],
              ['7M', 11, 'Si'],
              ['8J', 12, 'Dó (uma oitava acima)'],
              ['9m', 13, 'Ré♭ (uma oitava acima)'],
              ['9M', 14, 'Ré (uma oitava acima)'],
              ['9#', 15, 'Ré♯ (uma oitava acima)'],
              ['11J', 17, 'Fá (uma oitava acima)'],
              ['11#', 18, 'Fá♯ (uma oitava acima)'],
              ['13m', 20, 'Lá♭ (uma oitava acima)'],
              ['13M', 21, 'Lá (uma oitava acima)'],
            ] as const
          ).map(([name, semis, example]) => (
            <tr key={name} className="border-t border-border">
              <td className="py-1.5 pr-3">
                <span className="font-semibold">{name}</span> <span className="text-muted-foreground">({INTERVAL_NAMES[name] ?? 'oitava justa'})</span>
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{semis}</td>
              <td className="py-1.5">{example}</td>
              <td className="py-1.5 pl-2"><div className="flex flex-wrap gap-2">{(['sequencia', 'juntas'] as const).map(mode => {
                const id = `formation-interval-${semis}-${mode}`;
                return <button key={mode} type="button" aria-pressed={synth.playing === id} aria-label={`Ouvir ${name} ${mode === 'juntas' ? 'juntas' : 'em sequência'}`} className={`min-h-10 rounded-lg border border-border px-3 text-xs ${synth.playing === id ? 'bg-primary/20 text-chord' : 'hover:bg-muted'}`} onClick={() => synth.play(id, [{ time: 0, dur: 0.7, pitch: 60 }, { time: mode === 'juntas' ? 0 : 0.8, dur: 0.9, pitch: 60 + semis }])}>{mode === 'juntas' ? 'Juntas' : 'Sequência'}</button>;
              })}</div></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="mt-2 text-sm text-muted-foreground">9ª, 11ª e 13ª correspondem a 2ª, 4ª e 6ª uma oitava acima. Notas com a mesma altura podem ter funções diferentes: Ré♯ (#9) e Mi♭ (3ª menor), por exemplo.</p>
    </section>
    <section>
      <h2 className="text-xl font-semibold">Tríades: acordes de três notas</h2>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        <li>
          <span className="font-semibold text-foreground">Maior (C):</span> fundamental + terça maior (4 semitons) + quinta justa (7). Dó, Mi, Sol.
        </li>
        <li>
          <span className="font-semibold text-foreground">Menor (Cm):</span> fundamental + terça menor (3) + quinta justa (7). Dó, Mi♭, Sol.
        </li>
        <li>
          <span className="font-semibold text-foreground">Diminuto (C°):</span> fundamental + terça menor (3) + quinta diminuta (6). Dó, Mi♭, Sol♭.
        </li>
        <li>
          <span className="font-semibold text-foreground">Aumentado (C+):</span> fundamental + terça maior (4) + quinta aumentada (8). Dó, Mi, Sol♯.
        </li>
      </ul>
      <p className="mt-2 text-muted-foreground">É a terça que decide se o acorde é maior ou menor; a quinta dá a estabilidade.</p>
      <FormationExample title="Compare as quatro tríades" suffixes={['', 'm', '°', '+']} synth={synth} />
    </section>
    <section>
      <h2 className="text-xl font-semibold">Tétrades e extensões</h2>
      <p className="mt-2 text-muted-foreground">
        Somando a sétima, a tríade vira tétrade: <strong>7</strong> (sétima menor, como em G7), <strong>7M</strong> (sétima maior, como em C7M), <strong>m7</strong>, <strong>m7(b5)</strong>{' '}
        (meio-diminuto) e <strong>°7</strong>. Acima da sétima vêm as extensões: a <strong>9</strong>, a <strong>11</strong> e a <strong>13</strong>, que dão cor ao acorde. Na cifra brasileira,
        C9 costuma significar Dó com nona somada (sem sétima) e C7(9) o dominante com nona.
      </p>
      <FormationExample title="Compare as tétrades" suffixes={['7M', '7', 'm7', 'm7(b5)', '°7']} synth={synth} />
      <p className="mt-3 text-sm text-muted-foreground">Cm7(b5) tem Si♭ (sétima menor); C°7 tem Si♭♭ (sétima diminuta, com a altura de Lá). A grafia explica por que são acordes diferentes.</p>
      <FormationExample title="Da tríade às extensões" suffixes={['', '9', '7', '7(9)', '7(13)', '7(b9)', '7(#9)', '7(#11)', '7(b13)']} synth={synth} />
      <p className="mt-3 text-sm text-muted-foreground"><strong className="text-foreground">Convenção do app:</strong> C9/add9 acrescenta Ré a Dó–Mi–Sol, sem sétima. C7(9) inclui também Si♭. Em outras convenções, C9 pode indicar o dominante com nona; confira sempre a fórmula.</p>
      <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Suspensão não é extensão:</strong> Csus4 troca Mi por Fá; C7(9,11) mantém Mi e acrescenta Fá, podendo criar atrito. Da mesma forma, b5 altera a quinta, enquanto #11 é uma extensão e pode coexistir com a quinta justa.</p>
      <FormationExample title="Compare suspensão e décima primeira" suffixes={['', 'sus4', '7sus4', '7(9,11)']} synth={synth} />
    </section>
    <section>
      <h2 className="text-xl font-semibold">Inversões e baixo</h2>
      <p className="mt-2 text-muted-foreground">
        As mesmas notas podem ser tocadas com outra nota embaixo. C/E é o Dó maior com Mi no baixo (primeira inversão); C/G, com Sol no baixo (segunda inversão). A barra na cifra indica
        a nota do baixo.
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        {[0, 1, 2].map((v) => (
          <div key={v} className="rounded-xl border border-border p-2 text-center text-sm">
            <ChordDiagram chord="C" instrument="teclado" variant={v} />
            <p className="text-muted-foreground">{['Estado fundamental', '1ª inversão (C/E)', '2ª inversão (C/G)'][v]}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Em F/G, Sol não pertence à tríade F–A–C: é um baixo externo, não uma inversão simples de F. Em uma tétrade, colocar a sétima no baixo produz a terceira inversão.</p>
      <div className="mt-3 flex flex-wrap gap-3">{['C', 'C/E', 'C/G', 'C7/Bb', 'F/G'].map(chord => <div key={chord} className="rounded-xl border border-border p-3"><p className="mb-2 font-semibold text-chord">{chord}</p><PlayButton active={synth.playing === `formation-bass-${chord}`} onClick={() => synth.play(`formation-bass-${chord}`, chordEvents([chord], 90, 2))} label={chord} /></div>)}</div>
      <p className="mt-2 text-xs text-muted-foreground">Ouça cada exemplo na ordem: C, C/E, C/G, C7/Bb e F/G.</p>
    </section>
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">Pratique a formação</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground"><li>Compare C e Cm: ouça e identifique a mudança de Mi para Mi♭.</li><li>Compare C7M e C7: a mudança está na sétima, não na terça.</li><li>Compare C9 e C7(9): procure a nota Si♭ no segundo acorde.</li><li>Ouça C/E e C/G: as notas do acorde permanecem, mas o baixo muda.</li></ol>
    </section>
  </div>
  );
};

const ScalesTab = ({ onChord }: { onChord: (chord: string) => void }) => {
  const synth = useStudySynth();
  const [key, setKey] = useState('C');
  const [kind, setKind] = useState<ScaleKind>('major');
  const notes = scaleNotes(key, kind);
  const pcs = notes.map(pcOf);
  const referenceOnly = kind === 'majorPentatonic' || kind === 'minorPentatonic' || kind === 'blues';
  const mode = kind === 'majorPentatonic' ? 'major' : kind === 'minorPentatonic' || kind === 'blues' ? 'minor' : kind;
  const field = harmonicField(key, mode);
  const parallelMajor = harmonicField(key, 'major');
  const borrowedMode = mode === 'major' ? 'minor' : mode;
  const borrowed = harmonicField(key, borrowedMode).filter((chord, index) => chord.triad !== parallelMajor[index]!.triad);
  const steps = SCALES[kind].steps;
  const pattern = steps.map((s, i) => ((steps[i + 1] ?? 12) - s === 1 ? 'S' : (steps[i + 1] ?? 12) - s === 2 ? 'T' : `${(steps[i + 1] ?? 12) - s}st`)).join(' ');
  const degree = (i: number) => field[i]!.triad;
  const modal = !['major', 'minor', 'harmonicMinor'].includes(mode);
  const progressions: [string, number[]][] = modal
    ? mode === 'dorian' ? [['i – IV – i', [0, 3, 0]]]
    : mode === 'phrygian' ? [['i – bII – i', [0, 1, 0]]]
    : mode === 'lydian' ? [['I – II – I', [0, 1, 0]]]
    : mode === 'mixolydian' ? [['I – bVII – IV – I', [0, 6, 3, 0]]]
    : [['i° – bII – i° (exploração)', [0, 1, 0]]]
    :
    mode === 'harmonicMinor'
      ? [
          ['i – iv – V', [0, 3, 4]],
          ['i – VI – V', [0, 5, 4]],
          ['iiø – V – i', [1, 4, 0]],
        ]
      : mode === 'major'
    ? [
        ['I – V – vi – IV', [0, 4, 5, 3]],
        ['ii – V – I', [1, 4, 0]],
        ['I – vi – IV – V', [0, 5, 3, 4]],
        ['I – IV – V', [0, 3, 4]],
      ]
    : [
        ['i – VI – III – VII', [0, 5, 2, 6]],
        ['i – iv – v', [0, 3, 4]],
        ['i – VII – VI – VII', [0, 6, 5, 6]],
      ];

  return (
    <div className="mt-6 space-y-6">
      <div><p className="text-xs text-muted-foreground">Tônica</p><div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Tom" onKeyDown={rovingKeys}>{KEYS.map(note => <Chip key={note} active={key === note} onClick={() => { synth.stop(); setKey(note); }} label={`${note} (${solfege(note)})`}><span className="block font-semibold">{note}</span><span className="block text-[10px] text-muted-foreground">{solfege(note)}</span></Chip>)}</div></div>
      <div><p className="text-xs text-muted-foreground">Escala e modo</p><div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Escala" onKeyDown={rovingKeys}>{(Object.keys(SCALES) as ScaleKind[]).map(scale => <Chip key={scale} active={kind === scale} onClick={() => { synth.stop(); setKind(scale); }}>{scale === 'major' ? 'Maior / Jônio' : scale === 'minor' ? 'Menor natural / Eólio' : SCALES[scale].name}</Chip>)}</div></div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {key} {SCALES[kind].name.toLowerCase()}
        </h2>
        <p className="mt-1 text-lg tracking-wide">{notes.join(' · ')}</p>
        {steps.length === 7 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Graus da escala">{notes.map((note, index) => {
          const difference = steps[index]! - SCALES.major.steps[index]!;
          return <div key={index} className={`rounded-lg border px-3 py-2 text-sm ${difference ? 'border-primary/50 bg-primary/10' : 'border-border'}`}><strong className="block text-chord">{note}</strong><span className="text-xs text-muted-foreground">{difference < 0 ? 'b' : difference > 0 ? '#' : ''}{index + 1} · {index + 1}º grau{difference ? ' alterado em relação ao maior' : ''}</span></div>;
        })}</div>}
        <p className="mt-1 text-sm text-muted-foreground">
          Passos: {pattern} (T = tom, S = semitom). {SCALES[kind].about}
        </p>
        <div className="mt-3">
          <ScaleKeyboard pcs={pcs} />
        </div>
        <div className="mt-3"><PlayButton active={synth.playing === 'scale-run'} onClick={() => { const pitches = [...steps, 12, ...steps.slice(1).reverse(), 0]; synth.play('scale-run', pitches.map((step, index) => ({ time: index * 0.35, dur: 0.32, pitch: 60 + pcOf(key) + step }))); }} label={`escala de ${key} ${SCALES[kind].name}`} /></div>
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <h3 className="font-semibold">Entenda {key} {SCALES[kind].name.toLowerCase()}</h3>
          <p className="text-sm text-muted-foreground">{SCALE_CONTEXT[kind].character}</p>
          <p className="text-sm text-muted-foreground"><strong className="text-foreground">Contexto musical: </strong>{SCALE_CONTEXT[kind].use}</p>
          <p className="text-sm text-muted-foreground"><strong className="text-foreground">Experimente: </strong>{SCALE_CONTEXT[kind].practice}</p>
        </div>
        {(mode === 'major' || mode === 'minor') && !referenceOnly && <p className="mt-2 text-sm text-muted-foreground">Relativo: {mode === 'major' ? `${scaleNotes(key, 'major')[5]} menor` : `${scaleNotes(key, 'minor')[2]} maior`} (mesmas notas, outro centro).</p>}
        <p className="mt-2 text-sm text-muted-foreground">Jônio corresponde à escala maior e eólio à menor natural. Comparar modos com a mesma tônica ajuda a ouvir as notas características; usar as mesmas notas com outro centro é uma relação diferente.</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Campo harmônico {referenceOnly ? 'de referência: ' : 'de '}{key} {SCALES[mode].name.toLowerCase()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{referenceOnly ? 'Pentatônicas e blues não geram este campo de sete graus por empilhamento de terças. Abaixo está o campo maior ou menor natural de referência, que pode conter notas ausentes na escala selecionada.' : 'Acordes construídos por terças usando apenas as notas da escala selecionada. Nos modos, as funções tonais tradicionais não se aplicam automaticamente.'} Toque no nome para ver a formação.</p>
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2" aria-label="Campo harmônico">
          {field.map((d) => (
            <li key={d.roman} className="rounded-xl border border-border p-3 text-center">
              <span className="block text-xs text-muted-foreground">Tríade · {d.roman}</span>
              <button type="button" aria-label={`Tríade ${d.triad}`} onClick={() => onChord(d.triad)} className="font-[family-name:var(--font-display)] text-2xl font-semibold text-chord hover:underline">
                {d.triad}
              </button>
              <span className="mt-2 block border-t border-border pt-2 text-xs text-muted-foreground">Tétrade · {d.tetradRoman}</span>
              <button type="button" aria-label={`Tétrade ${d.tetrad}`} onClick={() => onChord(d.tetrad)} className="text-sm font-semibold text-chord hover:underline">
                {d.tetrad}
              </button>
              <div className="mt-2 flex flex-wrap justify-center gap-1">{[d.triad, d.tetrad].map((chord, index) => <button key={index} type="button" aria-label={`Ouvir ${chord}`} aria-pressed={synth.playing === `field-${index}-${chord}`} className="min-h-10 rounded-lg bg-muted px-2 text-xs" onClick={() => synth.play(`field-${index}-${chord}`, chordEvents([chord], 90, 2))}>Ouvir {index ? 'tétrade' : 'tríade'}</button>)}</div>
            </li>
          ))}
        </ul>
        {mode === 'major' && (
          <p className="mt-3 text-sm text-muted-foreground">
            Funções: <strong>tônica</strong> (repouso) {degree(0)}, {degree(2)} e {degree(5)}; <strong>subdominante</strong> (afastamento) {degree(1)} e {degree(3)}; <strong>dominante</strong>{' '}
            (tensão que pede volta) {degree(4)} e {degree(6)}.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{modal ? 'Explore a cor do modo' : 'Progressões comuns neste tom'}</h2>
        <ul className="mt-2 space-y-2">
          {progressions.map(([name, degrees]) => (
            <li key={name as string} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-40 text-muted-foreground">{name as string}</span>
              {(degrees as number[]).map((i, k) => (
                <button key={k} type="button" onClick={() => onChord(degree(i))} className="min-h-9 rounded-lg bg-muted px-3 font-bold text-chord">
                  {degree(i)}
                </button>
              ))}
              <PlayButton active={synth.playing === `scale-progression-${name}`} onClick={() => synth.play(`scale-progression-${name}`, chordEvents(degrees.map(degree), 90, 2))} label={name} />
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Empréstimo modal: compare centros iguais</h2>
        <p className="mt-2 text-sm text-muted-foreground">Em uma música em {key} maior, podemos buscar cores em {key} {SCALES[borrowedMode].name.toLowerCase()}. Isso é diferente de mudar para o relativo: a tônica de referência permanece {key}. Um acorde isolado não prova empréstimo; a função depende da frase e da resolução.</p>
        <div className="mt-3 flex flex-wrap gap-2">{borrowed.map(chord => <button key={chord.roman} type="button" onClick={() => onChord(chord.triad)} className="min-h-11 rounded-lg border border-border px-3 text-left"><span className="block text-xs text-muted-foreground">{chord.roman}</span><strong className="text-chord">{chord.triad}</strong></button>)}</div>
        <p className="mt-3 text-sm text-muted-foreground">Exemplo: I – iv – I empresta o iv do menor paralelo para o maior. Ouça o contraste do IV maior com o iv menor.</p>
        <div className="mt-3 flex flex-wrap gap-3">{(['major', 'minor'] as const).map(source => { const chords = [parallelMajor[0]!.triad, harmonicField(key, source)[3]!.triad, parallelMajor[0]!.triad]; return <div key={source}><p className="mb-2 text-sm font-semibold text-chord">{source === 'major' ? 'I – IV – I' : 'I – iv – I'} · {chords.join(' – ')}</p><PlayButton active={synth.playing === `borrow-${source}`} onClick={() => synth.play(`borrow-${source}`, chordEvents(chords, 90, 2))} label={source === 'major' ? 'I – IV – I' : 'I – iv – I'} /></div>; })}</div>
      </section>
    </div>
  );
};

/** Study: chord dictionary and grids for guitar, keyboard and cavaquinho, chord theory, scales and harmonic fields. */
export const StudyPage = () => {
  const [params, setParams] = useSearchParams();
  const asked = parseChord(params.get('acorde'));
  const [tab, setTabState] = useState<Tab>(() => TABS.find((t) => t.aba === params.get('aba'))?.id ?? 'chords');
  const setTab = (t: Tab) => {
    setTabState(t);
    const aba = TABS.find((x) => x.id === t)!.aba;
    setParams(t === 'chords' && params.get('acorde') ? { acorde: params.get('acorde')! } : { aba }, { replace: true });
  };
  const [chordKey, setChordKey] = useState(0);
  const [initial, setInitial] = useState(asked);

  const openChord = (chord: string) => {
    setInitial(parseChord(chord));
    setChordKey((k) => k + 1);
    setTabState('chords');
    setParams({ acorde: chord }, { replace: true });
    window.scrollTo?.({ top: 0 });
  };

  // A link that changes ?acorde= or ?aba= while this page is open (e.g. "Entender este acorde" from a
  // progression) must take effect, not only change the address.
  const acorde = params.get('acorde');
  const aba = params.get('aba');
  const seen = useRef({ acorde, aba });
  useEffect(() => {
    const before = seen.current;
    seen.current = { acorde, aba };
    if (acorde && acorde !== before.acorde) {
      setInitial(parseChord(acorde));
      setChordKey((k) => k + 1);
      setTabState('chords');
      window.scrollTo?.({ top: 0 });
    } else if (aba && aba !== before.aba) {
      const t = TABS.find((x) => x.aba === aba);
      if (t) setTabState(t.id);
    }
  }, [acorde, aba]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/estudo" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord hover:text-primary">
            <ArrowLeft className="size-4" /> Trilhas de estudo
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Ferramentas</h1>
        </div>
        <Link to="/microfone" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted">
          <Mic className="size-4" /> Afinador e microfone
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-muted-foreground">Acordes no violão, no teclado e no cavaquinho, formação, campo harmônico, ciclo de quintas e quartas, progressões, escalas no braço e treino de ouvido.</p>
      <ScrollStrip className="mt-4" role="tablist" label="Assunto" selected={tab} onKeyDown={rovingKeys} innerClassName="rounded-xl border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-10 scroll-mx-4 whitespace-nowrap rounded-lg px-4 text-sm ${tab === t.id ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
      </ScrollStrip>
      {tab === 'chords' && <ChordsTab key={chordKey} initial={initial} />}
      {tab === 'theory' && <TheoryTab />}
      {tab === 'scales' && <ScalesTab onChord={openChord} />}
      {tab === 'circle' && <CircleOfFifths onChord={openChord} />}
      {tab === 'progressions' && <ProgressionCatalog />}
      {tab === 'fretboard' && <ScaleExplorer />}
      {tab === 'ear' && <IntervalTrainer />}
    </section>
  );
};
