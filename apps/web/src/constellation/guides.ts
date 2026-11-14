import { type Center, type Chord, type Move, type Quality, type Relation, chordName, commonTones, groupOf } from './harmony.ts';
import { constellationEvents } from './voicing.ts';
import { spellPitch } from '../lib/transpose.ts';

type Step = { root: number; quality: Quality; degree: string; melody: number; bass?: number; relation?: Relation; why: string };
type Template = { id: string; title: string; minor: boolean; about: string; steps: Step[] };
export type Guide = Omit<Template, 'steps'> & { steps: (Step & { chord: Chord })[] };
const templates: Template[] = [
  { id: 'ii-v-i', title: 'ii–V–I · preparar e chegar', minor: false, about: 'O ii prepara, o V concentra a tensão e o I recebe a chegada. A linha-guia mantém uma nota antes de descer meio tom.', steps: [
    { root: 2, quality: 'm7', degree: 'ii7', melody: 5, why: 'O ii abre a preparação da cadência.' },
    { root: 7, quality: '7', degree: 'V7', melody: 5, relation: 'preparacao', why: 'O ii conduz ao V; a nota da linha-guia permanece como sétima do dominante.' },
    { root: 0, quality: '7M', degree: 'I7M', melody: 4, relation: 'resolucao', why: 'A sétima do V desce meio tom para a terça do I: um gesto claro de chegada.' },
  ] },
  { id: 'turnaround', title: 'I–vi–ii–V–I · volta completa', minor: false, about: 'Um percurso frequente na música tonal: sair de casa pelo relativo, preparar a tensão e voltar. Segure notas comuns e evite saltos desnecessários.', steps: [
    { root: 0, quality: '7M', degree: 'I7M', melody: 4, why: 'A tônica apresenta a referência.' },
    { root: 9, quality: 'm7', degree: 'vi7', melody: 4, relation: 'notas-comuns', why: 'O relativo menor conserva notas da tônica, mudando a cor sem confirmar outro tom.' },
    { root: 2, quality: 'm7', degree: 'ii7', melody: 5, relation: 'preparacao', why: 'O ii encaminha o percurso para a dominante.' },
    { root: 7, quality: '7', degree: 'V7', melody: 5, relation: 'preparacao', why: 'A dominante mantém a linha-guia e prepara o retorno.' },
    { root: 0, quality: '7M', degree: 'I7M', melody: 4, relation: 'resolucao', why: 'A linha-guia desce meio tom e a harmonia volta ao I.' },
  ] },
  { id: 'plagal', title: 'I–IV–iv–I · cor do menor', minor: false, about: 'O iv é emprestado do modo menor paralelo. Observe a linha cromática no retorno: a cor muda, mas a referência continua sendo o tom maior.', steps: [
    { root: 0, quality: '7M', degree: 'I7M', melody: 7, why: 'Partida na tônica.' },
    { root: 5, quality: '7M', degree: 'IV7M', melody: 9, relation: 'continuidade', why: 'O IV afasta suavemente da tônica.' },
    { root: 5, quality: 'm6', degree: 'iv6', melody: 8, relation: 'emprestimo', why: 'A terça do IV desce meio tom: empréstimo do modo menor paralelo.' },
    { root: 0, quality: '7M', degree: 'I7M', melody: 7, relation: 'resolucao', why: 'O iv retorna ao I pela cadência plagal menor; a linha desce mais meio tom.' },
  ] },
  { id: 'subv', title: 'ii–subV–I · baixo cromático', minor: false, about: 'O subV substitui o V por outro dominante com o mesmo trítono, em equivalência enarmônica. O baixo desce por semitons até a tônica.', steps: [
    { root: 2, quality: 'm7', degree: 'ii7', melody: 5, why: 'O ii prepara a cadência.' },
    { root: 1, quality: '7', degree: 'subV7/I', melody: 5, relation: 'substituicao', why: 'O subV ocupa o lugar do V. A linha-guia permanece e o baixo desce meio tom.' },
    { root: 0, quality: '7M', degree: 'I7M', melody: 4, relation: 'resolucao', why: 'O subV chega ao I por semitom no baixo; a linha-guia também desce meio tom.' },
  ] },
  { id: 'descending', title: 'Baixo descendente · inversões', minor: false, about: 'As inversões desenham um baixo que desce pela escala. O acorde não muda de tonalidade só porque outra nota vai para o baixo.', steps: [
    { root: 0, quality: '7M', degree: 'I7M', melody: 4, why: 'Comece na tônica.' },
    { root: 0, quality: '7M', bass: 11, degree: 'I7M/7', melody: 4, relation: 'transformacao', why: 'Mesmas notas, sétima no baixo: a descida começa.' },
    { root: 9, quality: 'm7', degree: 'vi7', melody: 4, relation: 'notas-comuns', why: 'O baixo desce ao vi e a linha-guia permanece.' },
    { root: 9, quality: 'm7', bass: 7, degree: 'vi7/7', melody: 4, relation: 'transformacao', why: 'Inverta o vi, preservando as notas e descendo o baixo.' },
    { root: 5, quality: '7M', degree: 'IV7M', melody: 4, relation: 'continuidade', why: 'O IV recebe a descida; a linha-guia vira sua sétima maior.' },
    { root: 0, quality: '', bass: 4, degree: 'I/3', melody: 4, relation: 'continuidade', why: 'A primeira inversão do I mantém a direção do baixo.' },
    { root: 2, quality: 'm7', degree: 'ii7', melody: 5, relation: 'preparacao', why: 'O ii encerra a descida e prepara a cadência.' },
    { root: 7, quality: '7', degree: 'V7', melody: 5, relation: 'preparacao', why: 'O baixo salta à dominante para preparar o retorno.' },
    { root: 0, quality: '7M', degree: 'I7M', melody: 4, relation: 'resolucao', why: 'A cadência V–I fecha o desenho do baixo.' },
  ] },
  { id: 'minor-cadence', title: 'iiø–V–i · chegada menor', minor: true, about: 'O ii meio-diminuto prepara o V com nona menor. A chegada usa a tônica menor com sexta; a alteração do V é uma escolha de cor neste contexto.', steps: [
    { root: 2, quality: 'm7(b5)', degree: 'iiø7', melody: 5, why: 'O ii meio-diminuto abre a preparação menor.' },
    { root: 7, quality: '7(b9)', degree: 'V7(b9)', melody: 5, relation: 'preparacao', why: 'O iiø conduz ao V; a nota sustentada se torna a sétima do dominante.' },
    { root: 0, quality: 'm6', degree: 'i6', melody: 3, relation: 'resolucao', why: 'A linha-guia desce à terça menor da tônica.' },
  ] },
  { id: 'minor-line', title: 'Linha cromática · tônica menor', minor: true, about: 'Uma voz desce enquanto o acorde menor conserva sua identidade. Não é uma sequência de modulações: é movimento dentro da mesma região harmônica.', steps: [
    { root: 0, quality: 'm', degree: 'i', melody: 0, why: 'Comece na tríade menor.' },
    { root: 0, quality: 'm(7M)', degree: 'i(7M)', melody: -1, relation: 'transformacao', why: 'A voz superior desce meio tom à sétima maior.' },
    { root: 0, quality: 'm7', degree: 'i7', melody: -2, relation: 'transformacao', why: 'A voz continua descendo à sétima menor.' },
    { root: 0, quality: 'm6', degree: 'i6', melody: -3, relation: 'transformacao', why: 'A descida termina na sexta, sem exigir mudança de centro.' },
  ] },
  { id: 'common-tone', title: 'Nota comum · ponte de cores', minor: false, about: 'Sustente a mesma nota ao trocar de cor. Notas comuns ajudam a ligar os acordes, mas não garantem função tonal; a cadência final dá direção ao percurso.', steps: [
    { root: 0, quality: '', degree: 'I', melody: 0, why: 'Apresente a nota da tônica.' },
    { root: 0, quality: 'm', degree: 'i emprestado', melody: 0, relation: 'emprestimo', why: 'Mude a terça para menor e mantenha a nota da linha-guia.' },
    { root: 8, quality: '', degree: '♭VI', melody: 0, relation: 'notas-comuns', why: 'A nota sustentada agora é a terça do ♭VI: proximidade de vozes, sem modulação automática.' },
    { root: 7, quality: '7', degree: 'V7', melody: -1, relation: 'preparacao', why: 'O V recupera a direção tonal; a linha-guia desce à sensível.' },
    { root: 0, quality: '', degree: 'I', melody: 0, relation: 'resolucao', why: 'A sensível sobe meio tom e o V chega ao I.' },
  ] },
];

const mod12 = (n: number) => (n % 12 + 12) % 12;
export const guidesFor = (center: Center): Guide[] => templates.filter(t => t.minor === center.minor).map(t => ({ ...t, steps: t.steps.map(step => ({ ...step, chord: {
  root: mod12(center.root + step.root), quality: step.quality,
  ...(step.bass === undefined ? {} : { bass: mod12(center.root + step.bass) }),
  ...([1, 3, 8, 10].includes(step.root) ? { flat: true } : {}),
} })) }));

export const guideMove = (guide: Guide, cursor: number, center: Center): Move | null => {
  const from = guide.steps[cursor]; const next = guide.steps[cursor + 1];
  if (!from || !next) return null;
  const commonNotes = commonTones(from.chord, next.chord, center);
  const following = guide.steps[cursor + 2]?.chord;
  return { to: next.chord, nextCenter: center, options: [], relation: next.relation ?? 'continuidade',
    motion: next.relation === 'resolucao' ? 'resolve' : ['dom', 'dim', 'hdim'].includes(groupOf(next.chord.quality)) ? 'tensiona' : 'relaxa',
    commonNotes, why: `${next.why}${commonNotes.length ? ` Notas comuns: ${commonNotes.map(pc => spellPitch(pc, center.minor ? chordName({ root: center.root, quality: 'm' }, center) : chordName({ root: center.root, quality: '' }, center))).join(', ')}.` : ' A ligação depende da condução das vozes, não de notas comuns.'}`,
    ...(groupOf(next.chord.quality) === 'dom' && following && !['dom', 'dim', 'hdim'].includes(groupOf(following.quality)) ? { resolvesTo: following, localTarget: following } : {}),
  };
};

/** A composed study voice, not a transcription or a promise of the only valid melody. */
export const guideEvents = (guide: Guide, center: Center) => {
  const span = 1.5; // Two beats at 80 BPM, as in constellationEvents.
  return [...constellationEvents(guide.steps.map(s => chordName(s.chord, center))),
    ...guide.steps.map((s, i) => ({ time: i * span, dur: span * 0.9, pitch: 72 + center.root + s.melody }))].sort((a, b) => a.time - b.time);
};
