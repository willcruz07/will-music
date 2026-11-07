import { Check, RotateCcw, Volume2, X } from 'lucide-react';
import { useState } from 'react';
import { ScrollStrip } from '../components/ScrollStrip.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { harmonicField } from '../lib/chordTheory.ts';
import { LessonBlocks, intervalName } from './blocks.tsx';
import { SCALE_LIBRARY, type ScaleId } from './theory.ts';
import type { Block } from './types.ts';
import { useStudySynth } from './widgets.tsx';

const chip = (active: boolean) =>
  `min-h-10 scroll-mx-4 whitespace-nowrap rounded-lg px-3 text-sm ${active ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`;

/* ---------- Ear training: hear two notes, name the interval ---------- */

const SETS = {
  basicos: { label: 'Básicos', semis: [3, 4, 5, 7, 12] },
  todos: { label: 'Todos', semis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
} as const;
type SetId = keyof typeof SETS;

const newQuestion = (set: SetId, random: () => number) => {
  const pool = SETS[set].semis;
  return { root: 55 + Math.floor(random() * 12), semis: pool[Math.floor(random() * pool.length)]! };
};

export const IntervalTrainer = ({ random = Math.random }: { random?: () => number }) => {
  const synth = useStudySynth();
  const [set, setSet] = useState<SetId>('basicos');
  const [q, setQ] = useState(() => newQuestion('basicos', random));
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const play = (harmonic = false) =>
    synth.play('intervalo', harmonic ? [{ time: 0, dur: 1.2, pitch: q.root }, { time: 0, dur: 1.2, pitch: q.root + q.semis }] : [{ time: 0, dur: 0.7, pitch: q.root }, { time: 0.75, dur: 0.9, pitch: q.root + q.semis }]);
  const next = (s: SetId = set) => {
    synth.stop();
    setQ(newQuestion(s, random));
    setAnswer(null);
  };
  const choose = (semis: number) => {
    if (answer !== null) return;
    setAnswer(semis);
    setScore((sc) => ({ right: sc.right + (semis === q.semis ? 1 : 0), total: sc.total + 1 }));
  };

  return (
    <div className="mt-6 max-w-2xl">
      <h2 className="text-xl font-semibold">Treino de intervalos</h2>
      <p className="mt-1 text-muted-foreground">Ouça as duas notas e diga a distância entre elas. Cante o intervalo por dentro antes de responder.</p>
      <ScrollStrip className="mt-4" role="radiogroup" label="Intervalos do treino" selected={set} onKeyDown={rovingKeys} innerClassName="gap-2">
        {(Object.keys(SETS) as SetId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={set === id}
            onClick={() => {
              setSet(id);
              next(id);
            }}
            className={chip(set === id)}
          >
            {SETS[id].label}
          </button>
        ))}
      </ScrollStrip>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => play()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
          <Volume2 className="size-4" /> Ouvir (melódico)
        </button>
        <button type="button" onClick={() => play(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 hover:bg-muted">
          Ouvir juntas
        </button>
        <button type="button" onClick={() => next()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 hover:bg-muted">
          <RotateCcw className="size-4" /> Próximo
        </button>
      </div>
      <div role="group" aria-label="Qual é o intervalo?" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SETS[set].semis.map((s) => {
          const state = answer === null ? '' : s === q.semis ? 'border-green-500 bg-green-500/15' : s === answer ? 'border-red-500 bg-red-500/15' : 'opacity-60';
          return (
            <button key={s} type="button" onClick={() => choose(s)} disabled={answer !== null} className={`min-h-11 rounded-lg border border-border px-3 text-left text-sm ${state}`}>
              {intervalName(s)}
            </button>
          );
        })}
      </div>
      <p role="status" className="mt-4 min-h-6 text-sm">
        {answer !== null &&
          (answer === q.semis ? (
            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
              <Check className="size-4" /> Certo: {intervalName(q.semis).toLowerCase()}.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
              <X className="size-4" /> Era {intervalName(q.semis).toLowerCase()}.
            </span>
          ))}
      </p>
      <p className="text-sm text-muted-foreground">
        Acertos: <span className="tabular-nums">{score.right} de {score.total}</span>
      </p>
    </div>
  );
};

/* ---------- Circle of fifths ---------- */

export const CIRCLE: { major: string; minor: string; signature: number }[] = [
  { major: 'C', minor: 'Am', signature: 0 },
  { major: 'G', minor: 'Em', signature: 1 },
  { major: 'D', minor: 'Bm', signature: 2 },
  { major: 'A', minor: 'F#m', signature: 3 },
  { major: 'E', minor: 'C#m', signature: 4 },
  { major: 'B', minor: 'G#m', signature: 5 },
  { major: 'F#', minor: 'D#m', signature: 6 },
  { major: 'Db', minor: 'Bbm', signature: -5 },
  { major: 'Ab', minor: 'Fm', signature: -4 },
  { major: 'Eb', minor: 'Cm', signature: -3 },
  { major: 'Bb', minor: 'Gm', signature: -2 },
  { major: 'F', minor: 'Dm', signature: -1 },
];
const SHARPS = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'];
const FLATS = ['Bb', 'Eb', 'Ab', 'Db', 'Gb'];

export const signatureText = (n: number): string =>
  n === 0 ? 'Sem acidentes' : n > 0 ? `${n} sustenido${n > 1 ? 's' : ''}: ${SHARPS.slice(0, n).join(' ')}` : `${-n} bemo${-n > 1 ? 'is' : 'l'}: ${FLATS.slice(0, -n).join(' ')}`;

export const CircleOfFifths = ({ onChord }: { onChord: (chord: string) => void }) => {
  const [sel, setSel] = useState(0);
  const key = CIRCLE[sel]!;
  const left = CIRCLE[(sel + 11) % 12]!;
  const right = CIRCLE[(sel + 1) % 12]!;
  const field = harmonicField(key.major, 'major');
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
      <div>
        <h2 className="text-xl font-semibold">Ciclo de quintas</h2>
        <p className="mt-1 text-sm text-muted-foreground">No sentido horário cada tom fica uma quinta acima (ganha um sustenido); no anti-horário, uma quarta acima (ganha um bemol). Dentro, o relativo menor.</p>
        <div role="radiogroup" aria-label="Tom no ciclo" className="relative mx-auto mt-4 aspect-square w-full max-w-[20rem]" onKeyDown={rovingKeys}>
          <div className="absolute inset-[12%] rounded-full border border-border" aria-hidden />
          {CIRCLE.map((k, i) => {
            const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
            const near = i === sel || i === (sel + 1) % 12 || i === (sel + 11) % 12;
            return (
              <button
                key={k.major}
                type="button"
                role="radio"
                aria-checked={i === sel}
                aria-label={`${k.major} maior (relativo ${k.minor})`}
                tabIndex={i === sel ? 0 : -1}
                onClick={() => setSel(i)}
                style={{ left: `${50 + 41 * Math.cos(a)}%`, top: `${50 + 41 * Math.sin(a)}%` }}
                className={`absolute flex size-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-sm leading-tight ${
                  i === sel ? 'border-primary bg-primary font-bold text-primary-foreground' : near ? 'border-primary/60 bg-surface' : 'border-border bg-surface hover:bg-muted'
                }`}
              >
                <span className="font-semibold">{k.major}</span>
                <span className={`text-[11px] ${i === sel ? '' : 'text-muted-foreground'}`}>{k.minor}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div aria-live="polite">
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{key.major} maior</h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Armadura</dt>
          <dd>{signatureText(key.signature)}</dd>
          <dt className="text-muted-foreground">Relativo menor</dt>
          <dd>{key.minor} (mesmas notas, começa no 6º grau)</dd>
          <dt className="text-muted-foreground">Tons vizinhos</dt>
          <dd>
            {left.major} (IV) e {right.major} (V): diferem por uma nota, ótimos para modular
          </dd>
        </dl>
        <p className="mt-4 text-sm font-semibold">Campo harmônico (toque para ver o acorde)</p>
        <ul aria-label={`Campo harmônico de ${key.major}`} className="mt-2 flex flex-wrap gap-2">
          {field.map((d) => (
            <li key={d.tetradRoman}>
              <button type="button" onClick={() => onChord(d.tetrad)} className="min-h-11 rounded-lg bg-muted px-3 text-left">
                <span className="block text-[11px] text-muted-foreground">{d.tetradRoman}</span>
                <span className="font-bold text-chord">{d.tetrad}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Os acordes dominantes resolvem no sentido anti-horário: {right.major}7 → {key.major}, {key.major}7 → {left.major}. É por isso que o ciclo também é chamado de ciclo de quartas.
        </p>
      </div>
    </div>
  );
};

/* ---------- Progressions catalog ---------- */

const P = (name: string, degrees: string[], caption: string, mode?: 'minor'): Block => ({ kind: 'progression', name, degrees, caption, ...(mode ? { mode } : {}) });

export const PROGRESSION_CATALOG: Block[] = [
  { kind: 'text', text: '**Pop, louvor e sertanejo.** Escolha o tom de cada uma e toque junto.' },
  P('I – V – vi – IV', ['I', 'V', 'vi', 'IV'], 'A progressão mais usada do pop e do louvor.'),
  P('vi – IV – I – V', ['vi', 'IV', 'I', 'V'], 'A mesma, começando pelo relativo menor: soa mais melancólica.'),
  P('I – vi – IV – V', ['I', 'vi', 'IV', 'V'], 'Anos 50, baladas e doo-wop.'),
  P('I – IV – V – IV', ['I', 'IV', 'V', 'IV'], 'Rock básico e sertanejo raiz.'),
  { kind: 'text', text: '**Jazz, bossa e MPB.**' },
  P('ii – V – I', ['ii7', 'V7', 'I7M'], 'A cadência mais importante do jazz.'),
  P('I – vi – ii – V (turnaround)', ['I7M', 'vi7', 'ii7', 'V7'], 'Volta ao início; troque o vi7 por V7/ii para mais tensão.'),
  P('iii – vi – ii – V – I', ['iii7', 'vi7', 'ii7', 'V7', 'I7M'], 'Encadeamento por quintas (ciclo).'),
  P('ii – subV – I', ['ii7', 'subV7', 'I7M'], 'Com substituto de trítono: o baixo desce em semitons.'),
  P('I – V7/ii – ii – V', ['I7M', 'V7/ii', 'ii7', 'V7'], 'Dominante secundário preparando o ii.'),
  { kind: 'text', text: '**Blues e rock.**' },
  P('Blues de 12 compassos', ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], 'Cada acorde é um compasso.'),
  P('I – bVII – IV', ['I', 'bVII', 'IV', 'I'], 'Empréstimo do mixolídio: som de rock clássico.'),
  { kind: 'text', text: '**Gospel e soul.**' },
  P('IV – iv – I', ['IV7M', 'iv6', 'I7M'], 'O "amém" com subdominante menor.'),
  P('Gospel com diminuto de passagem', ['I', 'iii7', 'IV', '#iv°7', 'V7sus4', 'V7', 'I'], 'Baixo subindo por graus com o diminuto entre o IV e o V.'),
  { kind: 'text', text: '**Tons menores.**' },
  P('i – iv – V', ['i', 'iv', 'V7', 'i'], 'Cadência menor com o V da menor harmônica.', 'minor'),
  P('i – VII – VI – V (andaluza)', ['i', 'VII', 'VI', 'V7'], 'Descida típica do flamenco e do rock.', 'minor'),
  P('ii° – V – i (menor)', ['iiø', 'V7', 'i'], 'O 2-5-1 menor: meio-diminuto, dominante, tônica menor.', 'minor'),
];

export const ProgressionCatalog = () => (
  <div className="mt-6 max-w-3xl">
    <h2 className="text-xl font-semibold">Progressões</h2>
    <p className="mt-1 text-muted-foreground">As progressões que mais aparecem em cada estilo, em graus. Mude o tom, ouça e toque nos acordes para ver como montar.</p>
    <LessonBlocks blocks={PROGRESSION_CATALOG} lessonId="catalogo-progressoes" />
  </div>
);

/* ---------- Scales on the fretboard ---------- */

const FAMILIES = [...new Set(Object.values(SCALE_LIBRARY).map((s) => s.family))];

export const ScaleExplorer = () => {
  const [scale, setScale] = useState<ScaleId>('major');
  return (
    <div className="mt-6 max-w-3xl">
      <h2 className="text-xl font-semibold">Escalas no braço e no teclado</h2>
      <p className="mt-1 text-muted-foreground">Escolha uma das {Object.keys(SCALE_LIBRARY).length} escalas e uma tônica: veja as notas, o desenho no teclado, no braço e a digitação em tablatura.</p>
      <label className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        Escala
        <select value={scale} onChange={(e) => setScale(e.target.value as ScaleId)} aria-label="Escala" className="h-10 max-w-full rounded-lg border border-border bg-background px-2">
          {FAMILIES.map((f) => (
            <optgroup key={f} label={f}>
              {(Object.keys(SCALE_LIBRARY) as ScaleId[])
                .filter((id) => SCALE_LIBRARY[id].family === f)
                .map((id) => (
                  <option key={id} value={id}>
                    {SCALE_LIBRARY[id].name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <LessonBlocks key={scale} blocks={[{ kind: 'scale', scale, root: 'C' }]} lessonId="explorar-escalas" />
    </div>
  );
};
