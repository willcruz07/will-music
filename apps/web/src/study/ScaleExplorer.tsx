import { useState } from 'react';
import { KEYS, pcOf } from '../lib/chordTheory.ts';
import { rovingKeys } from '../lib/a11y.ts';
import { SCALE_CONTEXT } from './scaleContext.ts';
import { SCALE_LIBRARY, boxTab, firstBoxFret, fretboardBox, spellScale, tabEvents, type ScaleId, type ScaleInfo } from './theory.ts';
import { Fretboard, PlayButton, ScaleKeyboard, useStudySynth } from './widgets.tsx';

const IDS = Object.keys(SCALE_LIBRARY) as ScaleId[];
const FAMILIES = [...new Set(IDS.map(id => SCALE_LIBRARY[id].family))];
const TUNING = [40, 45, 50, 55, 59, 64];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const FAMILY_CONTEXT: Record<ScaleInfo['family'], string> = {
  'Maior e modos': 'Mantenha a tônica como referência ao comparar os modos. Compartilhar notas com uma escala maior não significa manter o mesmo centro sonoro.',
  Menores: 'Compare as formas da escala menor sobre a mesma tônica. O contexto harmônico determina quais sextas e sétimas funcionam em cada frase.',
  'Jazz e simétricas': 'Estas escalas oferecem cores específicas. Antes de improvisar, compare suas notas com as notas e alterações do acorde; a escolha não se aplica a qualquer dominante.',
  'Pentatônicas e blues': 'Comece com motivos curtos e variações rítmicas. Procure notas de chegada compatíveis com o acorde e use as tensões como escolhas expressivas.',
  'Orientais e árabes': 'O desenho mostra uma aproximação em doze semitons. Maqamat e outras tradições incluem afinações, ornamentações e caminhos melódicos que uma escala isolada não representa.',
  'Indianas (thaats)': 'Thaats são conjuntos de referência, não ragas completos. A execução tradicional envolve frases, hierarquias de notas e ornamentações que não estão descritas apenas por este desenho temperado.',
};
const chip = (active: boolean) => `min-h-11 rounded-lg border px-3 py-2 text-sm ${active ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border hover:bg-muted'}`;

export const ScaleExplorer = () => {
  const synth = useStudySynth();
  const [scale, setScale] = useState<ScaleId>('major');
  const [root, setRoot] = useState('C');
  const [position, setPosition] = useState(Math.max(0, firstBoxFret(0) - 1));
  const [display, setDisplay] = useState<'notes' | 'degrees'>('notes');
  const info: ScaleInfo = SCALE_LIBRARY[scale];
  const notes = spellScale(root, scale);
  const rootPc = pcOf(root);
  const pcs = info.steps.map(step => (rootPc + step) % 12);
  const boxStart = position === 0 ? 0 : position + 1;
  const box = fretboardBox(rootPc, info.steps, TUNING, boxStart);
  const tab = boxTab(box);
  const labels = Object.fromEntries(pcs.map((pc, index) => {
    const degree = info.degrees[index]!;
    const delta = info.steps[index]! - MAJOR[degree]!;
    return [pc, display === 'notes' ? notes[index]! : `${delta < 0 ? 'b'.repeat(-delta) : '#'.repeat(delta)}${degree + 1}`];
  }));
  const context = scale in SCALE_CONTEXT ? SCALE_CONTEXT[scale as keyof typeof SCALE_CONTEXT] : undefined;
  const change = (action: () => void) => { synth.stop(); action(); };
  const run = [...info.steps, 12, ...info.steps.slice(1).reverse(), 0];
  return <div className="mt-6 max-w-3xl space-y-5">
    <div><h2 className="text-xl font-semibold">Explorador de escalas</h2><p className="mt-1 text-muted-foreground">Explore {IDS.length} escalas no teclado e no braço. Compare regiões da mesma escala e ouça o percurso mostrado na tablatura.</p></div>
    <div><p className="text-xs text-muted-foreground">Família</p><div role="radiogroup" aria-label="Família de escalas" onKeyDown={rovingKeys} className="mt-1 flex flex-wrap gap-2">{FAMILIES.map(family => <button key={family} type="button" role="radio" aria-checked={info.family === family} className={chip(info.family === family)} onClick={() => change(() => setScale(IDS.find(id => SCALE_LIBRARY[id].family === family)!))}>{family}</button>)}</div></div>
    <div><p className="text-xs text-muted-foreground">Escala</p><div role="radiogroup" aria-label="Escala do explorador" onKeyDown={rovingKeys} className="mt-1 flex flex-wrap gap-2">{IDS.filter(id => SCALE_LIBRARY[id].family === info.family).map(id => <button key={id} type="button" role="radio" aria-checked={scale === id} className={chip(scale === id)} onClick={() => change(() => setScale(id))}>{SCALE_LIBRARY[id].name}</button>)}</div></div>
    <div><p className="text-xs text-muted-foreground">Tônica</p><div role="radiogroup" aria-label="Tônica do explorador" onKeyDown={rovingKeys} className="mt-1 flex flex-wrap gap-1">{KEYS.map(note => <button key={note} type="button" role="radio" aria-checked={root === note} className={chip(root === note)} onClick={() => change(() => { setRoot(note); setPosition(Math.max(0, firstBoxFret(pcOf(note)) - 1)); })}>{note}</button>)}</div></div>
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-lg font-semibold">{info.name} de {root}</h3>
      <p className="mt-2 text-lg text-chord">{notes.join(' · ')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{info.about}</p>
      <div className="mt-3"><PlayButton active={synth.playing === 'explorer-scale'} onClick={() => synth.play('explorer-scale', run.map((step, index) => ({ time: index * 0.35, dur: 0.32, pitch: 60 + rootPc + step })))} label={`escala ${info.name} de ${root}, subindo e descendo`} /></div>
      <div className="mt-4 space-y-2 border-t border-border pt-3"><p className="text-sm text-muted-foreground">{context?.character ?? FAMILY_CONTEXT[info.family]}</p>{context && <p className="text-sm text-muted-foreground"><strong className="text-foreground">Contexto: </strong>{context.use}</p>}<p className="text-sm text-muted-foreground"><strong className="text-foreground">Pratique: </strong>{context?.practice ?? 'Cante as notas, crie uma frase curta e repita-a em duas posições vizinhas. Ouça quais notas dão repouso e quais produzem tensão.'}</p></div>
      <div className="mt-4"><ScaleKeyboard pcs={pcs} label={`Notas de ${root} ${info.name} no teclado`} /></div>
    </section>
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="font-semibold">Posição no braço</h3>
      <div role="radiogroup" aria-label="Posição no braço" onKeyDown={rovingKeys} className="mt-2 flex flex-wrap gap-1">{Array.from({ length: 12 }, (_, fret) => <button key={fret} type="button" role="radio" aria-checked={position === fret} className={chip(position === fret)} onClick={() => change(() => setPosition(fret))}>{fret === 0 ? 'Aberta · 0–4' : `${fret}–${fret + 4}`}</button>)}</div>
      <div role="radiogroup" aria-label="Identificação das notas no braço" onKeyDown={rovingKeys} className="mt-3 flex flex-wrap gap-2">{(['notes', 'degrees'] as const).map(mode => <button key={mode} type="button" role="radio" aria-checked={display === mode} className={chip(display === mode)} onClick={() => setDisplay(mode)}>{mode === 'notes' ? 'Notas' : 'Graus'}</button>)}</div>
      <p className="my-3 text-xs text-muted-foreground">Afinação padrão E–A–D–G–B–E. Tônica preenchida; notas fora das casas {position}–{position + 4} ficam atenuadas. Arraste horizontalmente para explorar o braço.</p>
      <Fretboard pcs={pcs} root={rootPc} box={boxStart} labels={labels} />
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={position === 0} onClick={() => change(() => setPosition(value => value - 1))} className="min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-40">Região anterior</button><button type="button" disabled={position === 11} onClick={() => change(() => setPosition(value => value + 1))} className="min-h-11 rounded-lg border border-border px-3 text-sm disabled:opacity-40">Próxima região</button></div>
      <p className="mt-3 text-sm text-muted-foreground">Mudar a posição mantém as notas da escala e a tônica; apenas a região do instrumento muda. Os graus são medidos em relação à tônica, com alterações em relação à escala maior.</p>
    </section>
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="font-semibold">Percurso da posição em tablatura</h3>
      <p className="mt-2 text-sm text-muted-foreground">Sugestão ascendente, das cordas graves às agudas, nas casas {position}–{position + 4}. Não indica dedos da mão esquerda nem todas as digitações possíveis.</p>
      <pre className="thin-scrollbar mt-3 overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs leading-5">{tab}</pre>
      <div className="mt-3"><PlayButton active={synth.playing === 'explorer-position'} onClick={() => synth.play('explorer-position', tabEvents(tab, 90))} label="percurso da tablatura" /></div>
      <p className="mt-2 text-xs text-muted-foreground">Áudio em colcheias a 90 BPM. O percurso pode começar em outra nota da escala; não precisa começar na tônica.</p>
    </section>
    {(info.family === 'Orientais e árabes' || info.family === 'Indianas (thaats)') && <p className="text-sm text-muted-foreground">{FAMILY_CONTEXT[info.family]}</p>}
  </div>;
};
