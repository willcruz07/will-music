import { Check, RotateCcw, Volume2, X } from 'lucide-react';
import { useState } from 'react';
import { ScrollStrip } from '../components/ScrollStrip.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { harmonicField, pcOf, scaleNotes } from '../lib/chordTheory.ts';
import { intervalName } from './blocks.tsx';
import type { Block } from './types.ts';
import { PlayButton, SilentModeHint, chordEvents, useStudySynth } from './widgets.tsx';
import { ProgressionPractice } from './ProgressionPractice.tsx';

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
    synth.play(harmonic ? 'intervalo-juntas' : 'intervalo', harmonic ? [{ time: 0, dur: 1.2, pitch: q.root }, { time: 0, dur: 1.2, pitch: q.root + q.semis }] : [{ time: 0, dur: 0.7, pitch: q.root }, { time: 0.75, dur: 0.9, pitch: q.root + q.semis }]);
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
      <SilentModeHint className="mt-1.5" />
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
  const synth = useStudySynth();
  const [sel, setSel] = useState(0);
  const key = CIRCLE[sel]!;
  const left = CIRCLE[(sel + 11) % 12]!;
  const right = CIRCLE[(sel + 1) % 12]!;
  const field = harmonicField(key.major, 'major');
  const notes = scaleNotes(key.major, 'major');
  const cadence = [field[1]!.tetrad, field[4]!.tetrad, field[0]!.tetrad];
  const examples = [
    { id: 'fifths', label: 'Quintas: sentido horário', chords: Array.from({ length: 4 }, (_, index) => CIRCLE[(sel + index) % 12]!.major), hint: 'Fundamentais avançando por quintas. Os acordes maiores aqui demonstram o caminho; não pertencem todos ao campo do tom inicial.' },
    { id: 'fourths', label: 'Quartas: sentido anti-horário', chords: Array.from({ length: 4 }, (_, index) => CIRCLE[(sel - index + 12) % 12]!.major), hint: 'Fundamentais avançando por quartas. O mesmo sentido aparece em muitas resoluções de dominantes.' },
    { id: 'cadence', label: 'ii–V–I: preparação e resolução', chords: cadence, hint: 'O ii prepara o V7, que resolve no I7M. As fundamentais seguem por quartas e as qualidades vêm do campo maior selecionado.' },
  ];
  const activeExample = examples.find(example => synth.playing === `circle-${example.id}`);
  const highlighted = new Set(activeExample?.chords.map(chord => pcOf(/^[A-G][#b]*/u.exec(chord)![0])) ?? []);
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
      <div>
        <h2 className="text-xl font-semibold">Ciclo de quintas e quartas</h2>
        <p className="mt-1 text-sm text-muted-foreground">No sentido horário, cada centro fica uma quinta acima; no anti-horário, uma quarta acima. Os nomes menores mostram os relativos. A armadura muda um acidente por passo, com troca de grafia enarmônica na passagem entre sustenidos e bemóis.</p>
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
                onClick={() => { synth.stop(); setSel(i); }}
                style={{ left: `${50 + 41 * Math.cos(a)}%`, top: `${50 + 41 * Math.sin(a)}%` }}
                className={`absolute flex size-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-sm leading-tight ${highlighted.has(pcOf(k.major)) ? 'ring-2 ring-chord ring-offset-2 ring-offset-background' : ''} ${
                  i === sel ? 'border-primary bg-primary font-bold text-primary-foreground' : near ? 'border-primary/60 bg-surface' : 'border-border bg-surface hover:bg-muted'
                }`}
              >
                <span className="font-semibold">{k.major}</span>
                <span className={`text-[11px] ${i === sel ? '' : 'text-muted-foreground'}`}>{k.minor}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Ao ouvir um exemplo, os centros usados ficam destacados no círculo. O destaque mostra o caminho completo, sem acompanhamento nota a nota.</p>
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
            {left.major} (IV) e {right.major} (V): cada escala compartilha seis classes de altura com {key.major} maior
          </dd>
        </dl>
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h4 className="font-semibold">Entenda {key.major} maior</h4>
          <p className="mt-2 text-sm text-muted-foreground">Notas: {notes.join(' · ')}. A tônica é {key.major}; {key.minor} é o relativo menor e usa a mesma armadura, mas organiza a escuta em outro centro.</p>
          <p className="mt-2 text-sm text-muted-foreground">{right.major}7 pode preparar a chegada a {key.major}. Já {key.major}7 pode conduzir a {left.major}: a sétima menor transforma a qualidade do acorde e muda sua intenção harmônica.</p>
          <p className="mt-2 text-sm text-muted-foreground">O círculo organiza relações entre notas e tonalidades, mas não determina sozinho uma progressão. Visitar um acorde vizinho também não significa, por si só, mudar de tom.</p>
        </div>
        <p className="mt-4 text-sm font-semibold">Campo harmônico (toque para ver o acorde)</p>
        <ul aria-label={`Campo harmônico de ${key.major}`} className="mt-2 flex flex-wrap gap-2">
          {field.map((d) => (
            <li key={d.tetradRoman}>
              <button type="button" onClick={() => onChord(d.tetrad)} className="min-h-11 rounded-lg bg-muted px-3 text-left">
                <span className="block text-[11px] text-muted-foreground">{d.tetradRoman}</span>
                <span className="font-bold text-chord">{d.tetrad}</span>
              </button>
              <button type="button" aria-label={`Ouvir ${d.tetrad}`} aria-pressed={synth.playing === `circle-chord-${d.tetrad}`} onClick={() => synth.play(`circle-chord-${d.tetrad}`, chordEvents([d.tetrad], 90, 2))} className="mt-1 block min-h-10 w-full rounded-lg border border-border px-2 text-xs hover:bg-muted">Ouvir</button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Os acordes dominantes resolvem no sentido anti-horário: {right.major}7 → {key.major}, {key.major}7 → {left.major}. É por isso que o ciclo também é chamado de ciclo de quartas.
        </p>
        <section className="mt-5 space-y-3">
          <h4 className="font-semibold">Ouça os caminhos</h4>
          {examples.map(example => <div key={example.id} className="rounded-xl border border-border p-3"><p className="text-sm font-semibold">{example.label}</p><p className="mt-1 font-semibold text-chord">{example.chords.join(' → ')}</p><p className="mt-1 text-sm text-muted-foreground">{example.hint}</p><div className="mt-3"><PlayButton active={synth.playing === `circle-${example.id}`} onClick={() => synth.play(`circle-${example.id}`, chordEvents(example.chords, 90, 2))} label={example.label} /></div></div>)}
        </section>
        <section className="mt-5">
          <h4 className="font-semibold">O que muda nos tons vizinhos?</h4>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">{[left, right].map(neighbor => {
            const nextNotes = scaleNotes(neighbor.major, 'major');
            const currentPcs = new Set(notes.map(pcOf));
            const nextPcs = new Set(nextNotes.map(pcOf));
            const removed = notes.filter(note => !nextPcs.has(pcOf(note)));
            const added = nextNotes.filter(note => !currentPcs.has(pcOf(note)));
            return <div key={neighbor.major} className="rounded-xl border border-border p-3"><p className="font-semibold">{key.major} → {neighbor.major}</p><p className="mt-1 text-sm text-muted-foreground">Sai {removed.join(', ')}; entra <strong className="text-chord">{added.join(', ')}</strong>.</p><p className="mt-1 text-xs text-muted-foreground">{nextNotes.join(' · ')}</p><button type="button" onClick={() => { synth.stop(); setSel(CIRCLE.indexOf(neighbor)); }} className="mt-2 min-h-10 rounded-lg bg-muted px-3 text-sm">Explorar {neighbor.major}</button></div>;
          })}</div>
          <p className="mt-2 text-xs text-muted-foreground">A comparação usa classes de altura: na passagem entre sustenidos e bemóis, notas em comum podem aparecer com nomes enarmônicos diferentes, como F# e Gb.</p>
        </section>
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
  P('Jazz: ii9 – V13 – Imaj9', ['ii7(9)', 'V7(13)', 'I7M(9)'], 'Compare com ii–V–I básico: a nona colore o ii e o I, enquanto a 13ª maior amplia o dominante sem substituir sua terça e sétima.'),
  P('Jazz: dominante com #5', ['ii7(9)', 'V7(#5)', 'I7M(9)'], 'A quinta aumentada altera o V7. Em Dó, Ré# de G7(#5) pode subir para Mi de C7M(9). Ouça a condução por semitom; a resolução não depende apenas da escala.'),
  P('Jazz: subV com #11', ['ii7(9)', 'subV7(#11)', 'I7M(9)'], 'O subV substitui o dominante por outro a um trítono de distância. Sua #11 acrescenta a cor lídia dominante; o baixo pode descer cromaticamente até a tônica.'),
  P('Bossa e MPB: turnaround com b9 e 13', ['I6(9)', 'V7(b9)/ii', 'ii7(9)', 'V7(13)'], 'A tônica 6/9 passa ao dominante secundário com b9, preparando o ii menor. O V com 13ª conduz de volta ao I; são cores de acompanhamento, não uma batida de bossa sintetizada.'),
  P('MPB: subdominante menor com nona', ['IV7M(9)', 'iv6(9)', 'I7M(9)'], 'O iv menor é emprestado do modo menor paralelo. Sexta e nona ampliam a sonoridade sem apagar a mudança da terça do IV para o iv.'),
  { kind: 'text', text: '**Blues e rock.**' },
  P('Blues de 12 compassos', ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], 'Cada acorde é um compasso.'),
  P('I – bVII – IV', ['I', 'bVII', 'IV', 'I'], 'Empréstimo do mixolídio: som de rock clássico.'),
  { kind: 'text', text: '**Gospel e soul.**' },
  P('IV – iv – I', ['IV7M', 'iv6', 'I7M'], 'O "amém" com subdominante menor.'),
  P('Gospel com diminuto de passagem', ['I', 'iii7', 'IV', '#iv°7', 'V7sus4', 'V7', 'I'], 'Baixo subindo por graus com o diminuto entre o IV e o V.'),
  P('Soul: menor com 11ª e dominante com 13ª', ['ii7(9,11)', 'V7(9,13)', 'I7M(9)', 'vi7(9)'], 'A 11ª sobre o ii menor cria uma cor aberta; nona e 13ª ampliam o V. A passagem ao vi mantém a continuidade. O groove e a disposição das vozes mudam bastante o resultado.'),
  P('Gospel: suspensão, alteração e chegada', ['IV7M(9)', 'V7sus4(9)', 'V7(b9,b13)', 'I7M(9)'], 'A quarta suspensa prepara a entrada da terça do dominante. Depois, b9 e b13 intensificam a tensão antes do I. Nem todas as notas cabem em instrumentos com poucas cordas.'),
  { kind: 'text', text: '**Tons menores.**' },
  P('i – iv – V', ['i', 'iv', 'V7', 'i'], 'Cadência menor com o V da menor harmônica.', 'minor'),
  P('i – VII – VI – V (andaluza)', ['i', 'VII', 'VI', 'V7'], 'Descida típica do flamenco e do rock.', 'minor'),
  P('iiø – V – i (menor)', ['iiø', 'V7', 'i'], 'O 2-5-1 menor: meio-diminuto, dominante, tônica menor.', 'minor'),
  P('Menor: iiø – V(b9) – i6/9', ['iiø', 'V7(b9)', 'i6(9)'], 'O ii meio-diminuto prepara o V com nona menor. A chegada em menor com sexta e nona acrescenta uma cor de tônica menor; a sexta maior vai além da menor natural.', 'minor'),
  P('Menor: 11ª, b9 e b13', ['iv7(9,11)', 'V7(b9,b13)', 'i7(9)'], 'O iv menor estendido prepara o dominante alterado. A b13 do V antecipa a terça menor do i; compare esta tensão com o V7 simples no mesmo tom.', 'minor'),
];

export const ProgressionCatalog = () => (
  <div className="mt-6 max-w-3xl">
    <h2 className="text-xl font-semibold">Progressões</h2>
    <p className="mt-1 text-muted-foreground">As progressões que mais aparecem em cada estilo, em graus. Mude o tom, ouça e toque nos acordes para ver como montar.</p>
    <ProgressionPractice blocks={PROGRESSION_CATALOG} />
  </div>
);

export { ScaleExplorer } from './ScaleExplorer.tsx';
