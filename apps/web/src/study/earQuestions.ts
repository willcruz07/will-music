import { ROOTS } from '../lib/chordTheory.ts';
import type { SynthEvent } from '../lib/synth.ts';
import { chordEvents } from './widgets.tsx';
import { SCALE_LIBRARY, romanToChord, type ScaleId } from './theory.ts';

export type EarLevel = 'first' | 'harmony' | 'master';
export type EarKind = 'note' | 'interval' | 'degree' | 'chord' | 'scale' | 'progression';
export type EarOption = { id: string; label: string; events: SynthEvent[] };
export type EarQuestion = { kind: EarKind; prompt: string; reference: string; options: EarOption[]; correct: string; events: SynthEvent[]; explanation: string };
export const EAR_LEVELS: { id: EarLevel; name: string; subtitle: string }[] = [
  { id: 'first', name: 'Primeiros compassos', subtitle: 'Iniciante · notas com referência, intervalos básicos, maior e menor' },
  { id: 'harmony', name: 'Em harmonia', subtitle: 'Intermediário · graus, tríades, escalas e intervalos descendentes' },
  { id: 'master', name: 'Ouvido de mestre', subtitle: 'Pro · tétrades, tensões, modos e progressões' },
];
export const EAR_KIND_NAMES: Record<EarKind, string> = { note: 'Notas e regiões', interval: 'Intervalos', degree: 'Graus', chord: 'Acordes', scale: 'Escalas', progression: 'Progressões' };
const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)]!;
const shuffle = <T,>(items: readonly T[], random: () => number): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) { const next = Math.floor(random() * (index + 1)); [result[index], result[next]] = [result[next]!, result[index]!]; }
  return result;
};
const melody = (pitches: number[], step = 0.5): SynthEvent[] => pitches.map((pitch, index) => ({ time: index * step, dur: step * 0.85, pitch }));
const INTERVALS = [{ value: 1, name: 'Segunda menor' }, { value: 2, name: 'Segunda maior' }, { value: 3, name: 'Terça menor' }, { value: 4, name: 'Terça maior' }, { value: 5, name: 'Quarta justa' }, { value: 6, name: 'Trítono' }, { value: 7, name: 'Quinta justa' }, { value: 8, name: 'Sexta menor' }, { value: 9, name: 'Sexta maior' }, { value: 10, name: 'Sétima menor' }, { value: 11, name: 'Sétima maior' }, { value: 12, name: 'Oitava' }];

export const makeEarQuestion = (kind: EarKind, level: EarLevel, random = Math.random, absolute = false): EarQuestion => {
  const pc = Math.floor(random() * 12);
  const root = 48 + pc + pick([0, 12], random);
  let options: EarOption[];
  let correct: string;
  let reference: string;
  let explanation: string;
  let prompt: string;
  if (kind === 'note') {
    const names = level === 'first' ? ['C', 'D', 'E', 'F', 'G', 'A', 'B'] : ROOTS;
    const target = pick(names, random);
    const octave = pick([48, 60, 72], random);
    options = names.map(name => ({ id: name, label: name, events: melody([octave + ROOTS.indexOf(name)]) }));
    correct = target;
    reference = absolute ? 'Sem referência · reconhecimento absoluto opcional' : 'Primeiro som: Dó (C4). Depois, identifique a nota em outra região.';
    prompt = 'Qual é o nome da nota final?';
    explanation = `A nota é ${target}. O nome se repete em outras oitavas: a frequência muda, mas a classe de altura permanece. ${absolute ? 'Este exercício é opcional e não mede sozinho sua percepção musical.' : 'Use o Dó inicial como referência e compare a distância até a nota final.'}`;
    if (!absolute) options = options.map(option => ({ ...option, events: [...melody([60]), ...option.events.map(event => ({ ...event, time: event.time + 1 }))] }));
  } else if (kind === 'interval') {
    const pool = level === 'first' ? INTERVALS.filter(item => [3, 4, 5, 7, 12].includes(item.value)) : INTERVALS;
    const target = pick(pool, random);
    const form = level === 'first' ? 'up' : pick(level === 'master' ? ['up', 'down', 'together'] : ['up', 'down'], random);
    options = pool.map(item => ({ id: String(item.value), label: item.name, events: form === 'together' ? [{ time: 0, dur: 1.2, pitch: root }, { time: 0, dur: 1.2, pitch: root + item.value }] : melody(form === 'down' ? [root + item.value, root] : [root, root + item.value]) }));
    correct = String(target.value);
    prompt = 'Qual intervalo você ouviu?';
    reference = form === 'together' ? 'Notas simultâneas' : form === 'down' ? 'Intervalo descendente' : 'Intervalo ascendente';
    explanation = `${target.name}: distância de ${target.value} semitons. Compare a resposta correta com a alternativa que você escolheu.`;
  } else if (kind === 'degree') {
    const steps = SCALE_LIBRARY.major.steps;
    const pool = level === 'first' ? [0, 2, 4] : [0, 1, 2, 3, 4, 5, 6];
    const target = pick(pool, random);
    const referenceEvents = chordEvents([ROOTS[pc]!], 120, 2);
    options = pool.map(index => ({ id: String(index), label: `${index + 1}º grau`, events: [...referenceEvents, { time: 1.5, dur: 0.9, pitch: root + steps[index]! }] }));
    correct = String(target);
    prompt = 'Qual grau da escala maior é a nota final?';
    reference = `O acorde inicial estabelece ${ROOTS[pc]} maior. Depois vem a nota do desafio.`;
    explanation = `A nota final é o ${target + 1}º grau, ${steps[target]} semitons acima da tônica. O acorde inicial é a referência tonal.`;
  } else if (kind === 'chord') {
    if (level === 'master' && random() < 0.3) {
      const inversions = [0, 4, 7];
      const target = pick(inversions, random);
      const options = shuffle(inversions.map((interval, index) => {
        const chord = `${ROOTS[pc]}/${ROOTS[(pc + interval) % 12]}`;
        return { id: String(interval), label: index === 0 ? 'Estado fundamental' : `${index}ª inversão`, events: chordEvents([chord], 90, 2) };
      }), random);
      return { kind, prompt: 'Qual posição do acorde maior você ouviu?', reference: `Acorde de ${ROOTS[pc]} maior. Concentre-se na nota mais grave.`, options, correct: String(target), events: options.find(option => option.id === String(target))!.events, explanation: `O baixo é ${ROOTS[(pc + target) % 12]}. Fundamental no baixo: estado fundamental; terça no baixo: primeira inversão; quinta no baixo: segunda inversão.` };
    }
    const pool = level === 'first' ? ['', 'm'] : level === 'harmony' ? ['', 'm', '°', '+', 'sus4'] : ['7M', 'm7', '7', 'm7(b5)', '7(b9)', '7(#5)', '7(13)', 'm7(11)'];
    const labels: Record<string, string> = { '': 'Maior', m: 'Menor', '°': 'Diminuto', '+': 'Aumentado', sus4: 'Suspenso de quarta', '7M': 'Sétima maior', m7: 'Menor com sétima', '7': 'Dominante', 'm7(b5)': 'Meio-diminuto', '7(b9)': 'Dominante com b9', '7(#5)': 'Dominante com #5', '7(13)': 'Dominante com 13', 'm7(11)': 'Menor com sétima e 11' };
    correct = pick(pool, random);
    options = pool.map(suffix => ({ id: suffix, label: labels[suffix]!, events: chordEvents([`${ROOTS[pc]}${suffix}`], 90, 2) }));
    prompt = 'Qual é a qualidade ou a tensão do acorde?';
    reference = 'Todas as alternativas sonoras usam a mesma fundamental; compare sua estrutura.';
    explanation = `Você ouviu ${ROOTS[pc]}${correct}: ${labels[correct]}. A fundamental é mantida nas comparações para destacar a mudança de qualidade ou tensão.`;
  } else if (kind === 'scale') {
    const pool: ScaleId[] = level === 'first' ? ['major', 'minor'] : level === 'harmony' ? ['major', 'minor', 'harmonicMinor', 'majorPentatonic', 'minorPentatonic'] : ['dorian', 'phrygian', 'lydian', 'mixolydian', 'harmonicMinor', 'blues'];
    correct = pick(pool, random);
    options = pool.map(id => ({ id, label: SCALE_LIBRARY[id].name, events: melody([...SCALE_LIBRARY[id].steps, 12].map(step => root + step), 0.3) }));
    prompt = 'Qual escala ou modo você ouviu?';
    reference = 'Escala ascendente, começando e terminando na tônica.';
    explanation = SCALE_LIBRARY[correct as ScaleId].about;
  } else {
    const pool = [{ id: '251', label: 'ii–V–I', degrees: ['ii7', 'V7', 'I7M'] }, { id: 'sub', label: 'ii–subV–I', degrees: ['ii7', 'subV7', 'I7M'] }, { id: 'amen', label: 'IV–iv–I', degrees: ['IV7M', 'iv6', 'I7M'] }];
    const target = pick(pool, random);
    correct = target.id;
    options = pool.map(item => ({ id: item.id, label: item.label, events: chordEvents(item.degrees.map(degree => romanToChord(degree, ROOTS[pc]!)), 120, 2) }));
    prompt = 'Qual caminho harmônico você ouviu?';
    reference = `Três acordes com chegada em ${ROOTS[pc]} maior.`;
    explanation = `${target.label}: ${target.degrees.map(degree => romanToChord(degree, ROOTS[pc]!)).join(' → ')}. Compare a preparação, a tensão e a chegada.`;
  }
  const target = options.find(option => option.id === correct)!;
  const alternatives = shuffle(options.filter(option => option.id !== correct), random).slice(0, 3);
  return { kind, prompt, reference, explanation, correct, events: target.events, options: shuffle([target, ...alternatives], random) };
};

/** Balanced categories, randomized pitches and answers; no adjacent category repeats. */
export const makeEarRound = (level: EarLevel, random = Math.random): EarQuestion[] => {
  const kinds: EarKind[] = level === 'master' ? ['interval', 'degree', 'chord', 'scale', 'progression'] : ['note', 'interval', 'degree', 'chord', 'scale'];
  const first = shuffle(kinds, random);
  const second = shuffle(kinds, random);
  if (first.at(-1) === second[0]) [second[0], second[1]] = [second[1]!, second[0]!];
  return [...first, ...second].map(kind => makeEarQuestion(kind, level, random));
};
