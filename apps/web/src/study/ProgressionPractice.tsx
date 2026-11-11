import { useEffect, useState } from 'react';
import { StudyChordButton } from './StudyChordHelp.tsx';
import { KEYS } from '../lib/chordTheory.ts';
import { rovingKeys } from '../lib/a11y.ts';
import type { Block } from './types.ts';
import { romanToChord } from './theory.ts';
import { Rich } from './blocks.tsx';
import { PlayButton, chordEvents, useStudySynth } from './widgets.tsx';

type Progression = Extract<Block, { kind: 'progression' }>;
type Synth = ReturnType<typeof useStudySynth>;
const radioStyle = (active: boolean) => `min-h-11 rounded-lg border px-3 py-2 text-sm ${active ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border hover:bg-muted'}`;

const tensionsOf = (degree: string): string => {
  const names: Record<string, string> = { '9': '9ª maior', b9: '9ª menor', '#9': '9ª aumentada', '11': '11ª justa', '#11': '11ª aumentada', '13': '13ª maior', b13: '13ª menor', '#5': '5ª aumentada', b5: '5ª diminuta' };
  const tokens = [...degree.matchAll(/\(([^)]+)\)/gu)].flatMap(match => match[1]!.split(',')).filter(token => names[token]);
  return tokens.length ? `Cores: ${tokens.map(token => names[token]).join(' · ')}` : '';
};

const roleOf = (degree: string, blues: boolean, minor: boolean): string => {
  if (blues) return degree.startsWith('IV') ? 'Região do IV no blues' : degree.startsWith('V') ? 'Retorno / tensão no blues' : 'Centro do blues';
  if (degree.startsWith('subV')) return 'Substituto de trítono: aproximação cromática';
  if (degree.includes('/')) return 'Dominante secundário: prepara outro grau';
  if (degree.includes('°')) return 'Diminuto de passagem: ligação cromática';
  if (/^V7sus/u.test(degree)) return 'Suspensão antes da dominante';
  if (/^V(?:7|$)/u.test(degree)) return 'Dominante: tensão e resolução';
  if (/^ii(?:7|ø|$)/u.test(degree)) return 'Preparação da dominante';
  if (/^iv/u.test(degree)) return minor ? 'Subdominante menor' : 'Subdominante menor emprestada';
  if (/^IV/u.test(degree)) return 'Subdominante: afastamento';
  if (/^bVII/u.test(degree)) return 'Cor do mixolídio / empréstimo modal';
  if (/^I(?:7M|6|$)/u.test(degree) || /^i(?:7|6|$)/u.test(degree)) return 'Tônica: referência de repouso';
  if (/^vi/u.test(degree)) return 'Relativo menor / continuação';
  if (/^iii/u.test(degree)) return 'Ligação harmônica / continuação';
  return 'Grau do modo: ouça a ligação com o próximo acorde';
};

const PracticeCard = ({ block, id, synth, time }: { block: Progression; id: string; synth: Synth; time: number | null }) => {
  const [key, setKey] = useState(block.mode === 'minor' ? 'A' : 'C');
  const [bpm, setBpm] = useState(block.bpm ?? 80);
  const [loop, setLoop] = useState(false);
  const active = synth.playing === id;
  const bar = 240 / bpm;
  const chords = block.degrees.map(degree => romanToChord(degree, key, block.mode));
  const current = active && time !== null ? Math.floor(time / bar) : -1;
  const stop = () => { if (active) synth.stop(); };
  return <article className="mt-4 rounded-2xl border border-border bg-surface p-4">
    <h3 className="text-lg font-semibold">{block.name}</h3>
    {block.caption && <p className="mt-1 text-sm text-muted-foreground"><Rich text={block.caption} /></p>}
    <div className="mt-4"><p className="text-xs text-muted-foreground">Tom {block.mode === 'minor' ? 'menor' : 'maior'}</p><div role="radiogroup" aria-label={`Tom de ${block.name}`} onKeyDown={rovingKeys} className="mt-1 flex flex-wrap gap-1">{KEYS.map(note => <button key={note} type="button" role="radio" aria-checked={key === note} onClick={() => { stop(); setKey(note); }} className={radioStyle(key === note)}>{note}</button>)}</div></div>
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <PlayButton active={active} onClick={() => synth.play(id, chordEvents(chords, bpm), loop ? chords.length * bar : 0)} label={block.name ?? 'progressão'} />
      <label className="flex items-center gap-2 text-sm">BPM <input type="number" min={40} max={200} step={1} value={bpm} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) { stop(); setBpm(Math.max(40, Math.min(200, Math.round(value)))); } }} className="min-h-11 w-20 rounded-lg border border-border bg-background px-2" /></label>
      <button type="button" aria-pressed={loop} onClick={() => { stop(); setLoop(value => !value); }} className={radioStyle(loop)}>Repetir {loop ? 'ativado' : 'desativado'}</button>
    </div>
    <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label={`Acordes de ${block.name}`}>
      {chords.map((chord, index) => <li key={index} aria-current={current === index ? 'step' : undefined} className={`rounded-xl border p-3 ${current === index ? 'border-primary bg-primary/15' : 'border-border'}`}><span className="text-xs text-muted-foreground">{index + 1} · {block.degrees[index]}</span><StudyChordButton chord={chord} className="block min-h-10 py-1 text-left text-xl font-semibold text-chord hover:underline" /><p className="text-xs text-muted-foreground">{roleOf(block.degrees[index]!, block.name === 'Blues de 12 compassos', block.mode === 'minor')}</p>{tensionsOf(block.degrees[index]!) && <p className="mt-2 text-xs text-chord">{tensionsOf(block.degrees[index]!)}</p>}</li>)}
    </ol>
    <p className="mt-3 text-xs text-muted-foreground">Exemplo em 4/4: um compasso por acorde. BPM e repetição alterados interrompem a execução; toque em Ouvir para reiniciar. Ritmo, baixo e voicings de uma música real podem ser diferentes.</p>
  </article>;
};

export const ProgressionPractice = ({ blocks }: { blocks: Block[] }) => {
  const synth = useStudySynth();
  const [category, setCategory] = useState('Todas');
  const [time, setTime] = useState<number | null>(null);
  const groups: { name: string; blocks: Progression[] }[] = [];
  for (const block of blocks) {
    if (block.kind === 'text') groups.push({ name: block.text.match(/\*\*([^*]+)\*\*/u)?.[1]?.replace(/\.$/u, '') ?? block.text, blocks: [] });
    else if (block.kind === 'progression') groups.at(-1)?.blocks.push(block);
  }
  useEffect(() => {
    if (!synth.playing) { setTime(null); return; }
    const update = () => setTime(synth.position());
    update();
    const timer = window.setInterval(update, 80);
    const hide = () => { if (document.hidden) synth.stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hide); };
  }, [synth.playing]);
  return <>
    <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Categorias de progressões" onKeyDown={rovingKeys}>{['Todas', ...groups.map(group => group.name)].map(name => <button key={name} type="button" role="radio" aria-checked={category === name} className={radioStyle(category === name)} onClick={() => { synth.stop(); setCategory(name); }}>{name}</button>)}</div>
    <p className="mt-4 text-sm text-muted-foreground">Os graus mostram a estrutura; os acordes acompanham o tom escolhido. As funções abaixo são uma leitura didática possível, não uma regra para todos os arranjos.</p>
    {groups.filter(group => category === 'Todas' || category === group.name).map(group => <section key={group.name} className="mt-6"><h2 className="text-lg font-semibold">{group.name}</h2>{group.blocks.map((block, index) => <PracticeCard key={`${group.name}-${index}`} block={block} id={`${group.name}-${index}`} synth={synth} time={time} />)}</section>)}
    <aside className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-4"><h3 className="font-semibold">Compare ii–V–I e ii–subV–I</h3><p className="mt-2 text-sm text-muted-foreground">Na categoria Jazz, bossa e MPB, use o mesmo tom e BPM nos dois exemplos. Em Dó, Dm7–G7–C7M vira Dm7–Db7–C7M: G7 e Db7 compartilham o trítono (Si e Fá, escritos Dó♭ e Fá em Db7). O substituto aproxima o baixo da tônica por semitom.</p></aside>
  </>;
};
