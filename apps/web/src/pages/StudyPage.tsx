import { ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChordDiagram, type Instrument } from '../components/ChordDiagram.tsx';
import { InstrumentToggle, readInstrument } from '../components/ChordPanel.tsx';
import { CHORD_TYPES, INTERVAL_NAMES, KEYS, ROOTS, SCALES, type ScaleKind, SOLFEGE, chordFormation, harmonicField, pcOf, scaleNotes } from '../lib/chordTheory.ts';
import { rovingKeys } from '../lib/a11y.ts';

type Tab = 'chords' | 'theory' | 'scales';
const TABS: { id: Tab; label: string }[] = [
  { id: 'chords', label: 'Acordes' },
  { id: 'theory', label: 'Formação' },
  { id: 'scales', label: 'Escalas e campo harmônico' },
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
 * The chord a link asks for, as root + one of the study types: the bass is dropped, synonyms are
 * understood (m7b5, dim, maj7…) and an unknown kind falls back to the closest known one, never to C.
 */
export const parseStudyChord = (chord: string | null): { root: string; suffix: string } | null => {
  const m = chord ? /^([A-G][#b]*)([^/]*)/u.exec(chord.trim()) : null;
  if (!m) return null;
  const root = ROOTS.includes(m[1]!) ? m[1]! : ROOTS[pcOf(m[1]!)]!;
  let rest = m[2]!;
  for (const [re, to] of SYNONYMS) if (re.test(rest)) rest = rest.replace(re, to);
  const exact = CHORD_TYPES.find((t) => t.suffix === rest);
  if (exact) return { root, suffix: exact.suffix };
  const prefix = CHORD_TYPES.filter((t) => t.suffix && rest.startsWith(t.suffix)).sort((a, z) => z.suffix.length - a.suffix.length)[0];
  return { root, suffix: prefix?.suffix ?? '' };
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
const ChordsTab = ({ initial }: { initial: { root: string; suffix: string } | null }) => {
  const [root, setRoot] = useState(initial?.root ?? 'C');
  const [suffix, setSuffix] = useState(initial?.suffix ?? '');
  const [instrument, setInstrument] = useState<Instrument>(readInstrument);
  const [variant, setVariant] = useState(0);
  const [count, setCount] = useState(0);
  const [grid, setGrid] = useState<'roots' | 'types'>('types');
  const formation = chordFormation(root, suffix);
  const type = CHORD_TYPES.find((t) => t.suffix === suffix)!;
  const pick = (r: string, s: string) => {
    setRoot(r);
    setSuffix(s);
    setVariant(0);
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
          {ROOTS.map((r) => (
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

      <div className="grid gap-6 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          <ChordDiagram chord={formation.name} instrument={instrument} variant={variant} onVariants={setCount} size="lg" />
          {count > 1 && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <button type="button" aria-label="Forma anterior" onClick={() => setVariant((v) => (v - 1 + count) % count)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
                <ChevronLeft className="size-5" />
              </button>
              <span className="tabular-nums text-muted-foreground">
                {instrument === 'teclado' ? 'Inversão' : 'Forma'} {variant + 1} de {count}
              </span>
              <button type="button" aria-label="Próxima forma" onClick={() => setVariant((v) => (v + 1) % count)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </div>
        <section aria-label={`Formação de ${formation.name}`}>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            {formation.name} <span className="text-base font-normal text-muted-foreground">· {type.name}</span>
          </h2>
          <p className="mt-2 text-muted-foreground">{type.about}</p>
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
            Fórmula: {formation.intervals.join(' – ')}. {instrument === 'teclado' ? 'As inversões mudam qual nota fica embaixo.' : 'As outras formas tocam as mesmas notas em outra região do braço.'}
          </p>
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
          {(grid === 'roots' ? ROOTS.map((r) => [r, suffix] as const) : CHORD_TYPES.map((t) => [root, t.suffix] as const)).map(([r, s]) => (
            <li key={`${r}${s}`}>
              <button type="button" onClick={() => pick(r, s)} className={`flex w-full justify-center rounded-xl border p-2 transition-colors hover:border-primary ${r === root && s === suffix ? 'border-primary bg-primary/10' : 'border-border'}`} aria-label={`Ver ${r}${s}`}>
                <ChordDiagram chord={`${r}${s}`} instrument={instrument} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const TheoryTab = () => (
  <div className="mt-6 max-w-3xl space-y-8 leading-relaxed">
    <section>
      <h2 className="text-xl font-semibold">Intervalos: a régua da música</h2>
      <p className="mt-2 text-muted-foreground">
        Intervalo é a distância entre duas notas, contada em semitons (cada casa do violão ou cada tecla vizinha do teclado, contando as pretas). Todo acorde é uma pilha de intervalos a
        partir da nota que dá nome a ele, a <em>tônica</em>.
      </p>
      <table className="mt-3 w-full max-w-lg text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 pr-3 font-normal">Intervalo</th>
            <th className="py-1 pr-3 font-normal">Semitons</th>
            <th className="py-1 font-normal">A partir de Dó</th>
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
              ['9M', 14, 'Ré (uma oitava acima)'],
            ] as const
          ).map(([name, semis, example]) => (
            <tr key={name} className="border-t border-border">
              <td className="py-1.5 pr-3">
                <span className="font-semibold">{name}</span> <span className="text-muted-foreground">({INTERVAL_NAMES[name]})</span>
              </td>
              <td className="py-1.5 pr-3 tabular-nums">{semis}</td>
              <td className="py-1.5">{example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
    <section>
      <h2 className="text-xl font-semibold">Tríades: acordes de três notas</h2>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        <li>
          <span className="font-semibold text-foreground">Maior (C):</span> tônica + terça maior (4 semitons) + quinta justa (7). Dó, Mi, Sol.
        </li>
        <li>
          <span className="font-semibold text-foreground">Menor (Cm):</span> tônica + terça menor (3) + quinta justa (7). Dó, Mi♭, Sol.
        </li>
        <li>
          <span className="font-semibold text-foreground">Diminuto (C°):</span> tônica + terça menor (3) + quinta diminuta (6). Dó, Mi♭, Sol♭.
        </li>
        <li>
          <span className="font-semibold text-foreground">Aumentado (C+):</span> tônica + terça maior (4) + quinta aumentada (8). Dó, Mi, Sol♯.
        </li>
      </ul>
      <p className="mt-2 text-muted-foreground">É a terça que decide se o acorde é maior ou menor; a quinta dá a estabilidade.</p>
    </section>
    <section>
      <h2 className="text-xl font-semibold">Tétrades e extensões</h2>
      <p className="mt-2 text-muted-foreground">
        Somando a sétima, a tríade vira tétrade: <strong>7</strong> (sétima menor, como em G7), <strong>7M</strong> (sétima maior, como em C7M), <strong>m7</strong>, <strong>m7(b5)</strong>{' '}
        (meio-diminuto) e <strong>°7</strong>. Acima da sétima vêm as extensões: a <strong>9</strong>, a <strong>11</strong> e a <strong>13</strong>, que dão cor ao acorde. Na cifra brasileira,
        C9 costuma significar Dó com nona somada (sem sétima) e C7(9) o dominante com nona.
      </p>
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
    </section>
  </div>
);

const ScalesTab = ({ onChord }: { onChord: (chord: string) => void }) => {
  const [key, setKey] = useState('C');
  const [kind, setKind] = useState<ScaleKind>('major');
  const notes = scaleNotes(key, kind);
  const pcs = notes.map(pcOf);
  const mode = kind === 'major' || kind === 'majorPentatonic' ? 'major' : kind === 'harmonicMinor' ? 'harmonicMinor' : 'minor';
  const field = harmonicField(key, mode);
  const relative = mode === 'major' ? `${scaleNotes(key, 'major')[5]} menor` : `${scaleNotes(key, 'minor')[2]} maior`;
  const steps = SCALES[kind].steps;
  const pattern = steps.map((s, i) => ((steps[i + 1] ?? 12) - s === 1 ? 'S' : (steps[i + 1] ?? 12) - s === 2 ? 'T' : `${(steps[i + 1] ?? 12) - s}st`)).join(' ');
  const degree = (i: number) => field[i]!.triad;
  const progressions =
    mode === 'harmonicMinor'
      ? [
          ['i – iv – V', [0, 3, 4]],
          ['i – VI – V', [0, 5, 4]],
          ['ii° – V – i', [1, 4, 0]],
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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Tom
          <select aria-label="Tom" value={key} onChange={(e) => setKey(e.target.value)} className="h-10 rounded-lg border border-border bg-surface px-2">
            {KEYS.map((r) => (
              <option key={r} value={r}>
                {r} ({solfege(r)})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Escala
          <select aria-label="Escala" value={kind} onChange={(e) => setKind(e.target.value as ScaleKind)} className="h-10 rounded-lg border border-border bg-surface px-2">
            {(Object.keys(SCALES) as ScaleKind[]).map((k) => (
              <option key={k} value={k}>
                {SCALES[k].name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {key} {SCALES[kind].name.toLowerCase()}
        </h2>
        <p className="mt-1 text-lg tracking-wide">{notes.join(' · ')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Passos: {pattern} (T = tom, S = semitom). {SCALES[kind].about}
        </p>
        <div className="mt-3">
          <ScaleKeyboard pcs={pcs} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Tom relativo: {relative} (as mesmas notas, outro centro).</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Campo harmônico de {key} {mode === 'major' ? 'maior' : mode === 'minor' ? 'menor' : 'menor harmônico'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Os acordes que nascem de cada nota da escala, empilhando terças só com as notas dela. Toque num acorde para ver como tocar.</p>
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2" aria-label="Campo harmônico">
          {field.map((d) => (
            <li key={d.roman} className="rounded-xl border border-border p-3 text-center">
              <span className="block text-xs text-muted-foreground">{d.roman}</span>
              <button type="button" onClick={() => onChord(d.triad)} className="font-[family-name:var(--font-display)] text-2xl font-semibold text-chord hover:underline">
                {d.triad}
              </button>
              <span className="block text-xs text-muted-foreground">{d.tetrad}</span>
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
        <h2 className="text-lg font-semibold">Progressões comuns neste tom</h2>
        <ul className="mt-2 space-y-2">
          {progressions.map(([name, degrees]) => (
            <li key={name as string} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-40 text-muted-foreground">{name as string}</span>
              {(degrees as number[]).map((i, k) => (
                <button key={k} type="button" onClick={() => onChord(degree(i))} className="min-h-9 rounded-lg bg-muted px-3 font-bold text-chord">
                  {degree(i)}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

/** Study: chord dictionary and grids for guitar, keyboard and cavaquinho, chord theory, scales and harmonic fields. */
export const StudyPage = () => {
  const [params, setParams] = useSearchParams();
  const asked = parseChord(params.get('acorde'));
  const [tab, setTab] = useState<Tab>('chords');
  const [chordKey, setChordKey] = useState(0);
  const [initial, setInitial] = useState(asked);

  const openChord = (chord: string) => {
    setInitial(parseChord(chord));
    setChordKey((k) => k + 1);
    setTab('chords');
    setParams({ acorde: chord }, { replace: true });
    window.scrollTo?.({ top: 0 });
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Estudo</h1>
        <Link to="/microfone" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted">
          <Mic className="size-4" /> Afinador e microfone
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-muted-foreground">Todos os acordes no violão, no teclado e no cavaquinho, como eles são formados, as escalas e o campo harmônico de cada tom.</p>
      <div className="-mx-4 mt-4 overflow-x-auto px-4">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="tablist" onKeyDown={rovingKeys} aria-label="Assunto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-10 whitespace-nowrap rounded-lg px-4 text-sm ${tab === t.id ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'chords' && <ChordsTab key={chordKey} initial={initial} />}
      {tab === 'theory' && <TheoryTab />}
      {tab === 'scales' && <ScalesTab onChord={openChord} />}
    </section>
  );
};
