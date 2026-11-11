import { Lightbulb, TriangleAlert } from 'lucide-react';
import { Fragment, type ReactNode, useState } from 'react';
import { ChordHelp } from '../components/ChordHelp.tsx';
import { KEYS, SOLFEGE, pcOf, spellNote } from '../lib/chordTheory.ts';
import { SCALE_LIBRARY, boxTab, fretboardBox, firstBoxFret, rhythmEvents, romanToChord, spellScale, tabEvents } from './theory.ts';
import type { Block } from './types.ts';
import { Fretboard, PlayButton, ScaleKeyboard, chordEvents, useStudySynth } from './widgets.tsx';
import { SheetSelect } from '../ui/SheetSelect.tsx';

/** **bold** and *italic* inside lesson text. */
export const Rich = ({ text }: { text: string }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/gu).map((part, i) =>
      part.startsWith('**') ? (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      ) : part.startsWith('*') && part.length > 2 ? (
        <em key={i}>{part.slice(1, -1)}</em>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    )}
  </>
);

const INTERVAL_NAMES: Record<number, string> = {
  0: 'Uníssono',
  1: 'Segunda menor',
  2: 'Segunda maior',
  3: 'Terça menor',
  4: 'Terça maior',
  5: 'Quarta justa',
  6: 'Trítono (4ª aum. / 5ª dim.)',
  7: 'Quinta justa',
  8: 'Sexta menor',
  9: 'Sexta maior',
  10: 'Sétima menor',
  11: 'Sétima maior',
  12: 'Oitava',
};
const INTERVAL_STEPS: Record<number, number> = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6, 12: 7 };
export const intervalName = (semis: number) => INTERVAL_NAMES[semis] ?? `${semis} semitons`;
export const intervalNote = (root: string, semis: number) => spellNote(root, semis % 12, INTERVAL_STEPS[semis] ?? 0);

const Card = ({ children, title }: { children: ReactNode; title?: string }) => (
  <figure className="my-4 rounded-2xl border border-border bg-surface p-4">
    {title && <figcaption className="mb-2 text-sm font-semibold">{title}</figcaption>}
    {children}
  </figure>
);

const solfege = (k: string) => `${SOLFEGE[k[0]!]}${k.length > 1 ? (k[1] === 'b' ? '♭' : '♯') : ''}`;

const KeySelect = ({ value, onChange, label = 'Tom' }: { value: string; onChange: (k: string) => void; label?: string }) => (
  <span className="inline-flex items-center gap-2 text-sm">
    <span aria-hidden>{label}</span>
    <SheetSelect label={label} value={value} onChange={onChange} options={KEYS.map((k) => ({ value: k, label: k, hint: solfege(k) }))} className="h-9 min-w-16 font-semibold" />
  </span>
);

type Synth = ReturnType<typeof useStudySynth>;

const ChordChips = ({ chords, onHelp }: { chords: string[]; onHelp: (c: string, r: DOMRect) => void }) => (
  <div className="flex flex-wrap gap-2">
    {chords.map((c, i) => (
      <button key={`${c}-${i}`} type="button" onClick={(e) => onHelp(c, e.currentTarget.getBoundingClientRect())} aria-label={`Como tocar ${c}`} className="min-h-10 rounded-lg bg-muted px-3 font-bold text-chord hover:brightness-110">
        {c}
      </button>
    ))}
  </div>
);

const ProgressionBlock = ({ block, id, synth, onHelp }: { block: Extract<Block, { kind: 'progression' }>; id: string; synth: Synth; onHelp: (c: string, r: DOMRect) => void }) => {
  const [key, setKey] = useState(block.key ?? (block.mode === 'minor' ? 'A' : 'C'));
  const chords = block.degrees.map((d) => romanToChord(d, key, block.mode));
  return (
    <Card title={block.name}>
      <div className="flex flex-wrap items-center gap-3">
        <KeySelect value={key} onChange={setKey} />
        <PlayButton active={synth.playing === id} onClick={() => synth.play(id, chordEvents(chords, block.bpm ?? 80))} label={block.name ?? 'progressão'} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{block.degrees.join(' – ')}</p>
      <div className="mt-1">
        <ChordChips chords={chords} onHelp={onHelp} />
      </div>
      {block.caption && (
        <p className="mt-2 text-sm text-muted-foreground">
          <Rich text={block.caption} />
        </p>
      )}
    </Card>
  );
};

const ScaleBlock = ({ block, id, synth }: { block: Extract<Block, { kind: 'scale' }>; id: string; synth: Synth }) => {
  const [root, setRoot] = useState(block.root ?? 'C');
  const info = SCALE_LIBRARY[block.scale];
  const notes = spellScale(root, block.scale);
  const rootPc = pcOf(root);
  const pcs = info.steps.map((s) => (rootPc + s) % 12);
  const start = firstBoxFret(rootPc);
  const box = fretboardBox(rootPc, info.steps, [40, 45, 50, 55, 59, 64], start);
  const tabText = boxTab(box);
  const asc = info.steps.map((s, i) => ({ time: i * 0.32, dur: 0.3, pitch: 60 + rootPc + s }));
  const up = [...asc, { time: asc.length * 0.32, dur: 0.6, pitch: 72 + rootPc }];
  return (
    <Card title={`${info.name} de ${root}`}>
      <div className="flex flex-wrap items-center gap-3">
        <KeySelect value={root} onChange={setRoot} label="Tônica" />
        <PlayButton active={synth.playing === id} onClick={() => synth.play(id, up)} label={info.name} />
      </div>
      <p className="mt-3 text-lg tracking-wide">{notes.join(' · ')}</p>
      <p className="text-sm text-muted-foreground">{info.about}</p>
      <div className="mt-3">
        <ScaleKeyboard pcs={pcs} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">No braço (a tônica em verde; o quadro mostra uma posição para começar):</p>
      <Fretboard pcs={pcs} root={rootPc} box={start} />
      <p className="mt-3 text-xs text-muted-foreground">Digitação da posição em tablatura, da corda mais grave para a mais aguda:</p>
      <pre className="thin-scrollbar mt-1 overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs leading-5">{tabText}</pre>
      {block.caption && (
        <p className="mt-2 text-sm text-muted-foreground">
          <Rich text={block.caption} />
        </p>
      )}
    </Card>
  );
};

const IntervalsBlock = ({ block, id, synth }: { block: Extract<Block, { kind: 'intervals' }>; id: string; synth: Synth }) => {
  const root = block.root ?? 'C';
  const rootMidi = 60 + pcOf(root);
  return (
    <Card title={block.caption}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {block.semitones.map((s) => (
          <li key={s} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span>
              <span className="font-semibold">{intervalName(s)}</span>
              <span className="block text-xs text-muted-foreground">
                {s} semitons · {root} → {intervalNote(root, s)}
              </span>
            </span>
            <PlayButton
              active={synth.playing === `${id}-${s}`}
              onClick={() =>
                synth.play(`${id}-${s}`, [
                  { time: 0, dur: 0.55, pitch: rootMidi },
                  { time: 0.6, dur: 0.55, pitch: rootMidi + s },
                  { time: 1.3, dur: 1, pitch: rootMidi },
                  { time: 1.3, dur: 1, pitch: rootMidi + s },
                ])
              }
              label={intervalName(s)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
};

const SOUND_NAMES = { kick: 'Bumbo', snare: 'Caixa', hihat: 'Chimbal' } as const;

const RhythmBlock = ({ block, id, synth }: { block: Extract<Block, { kind: 'rhythm' }>; id: string; synth: Synth }) => {
  const p = block.pattern;
  const perBeat = p.perBeat ?? 4;
  return (
    <Card title={block.caption}>
      <div className="flex flex-wrap items-center gap-3">
        <PlayButton active={synth.playing === id} onClick={() => synth.play(id, rhythmEvents(p, 4))} label={block.caption ?? 'ritmo'} />
        <span className="text-sm text-muted-foreground">{p.bpm} BPM</span>
      </div>
      <div className="thin-scrollbar mt-3 overflow-x-auto">
        <table className="text-xs">
          <tbody>
            {p.tracks.map((t, r) => (
              <tr key={r}>
                <th className="pr-2 text-left font-normal text-muted-foreground">{t.label ?? SOUND_NAMES[t.sound]}</th>
                {[...t.pattern].map((c, i) => (
                  <td key={i} className={`h-6 w-6 border border-border text-center ${i % perBeat === 0 ? 'border-l-2 border-l-muted-foreground' : ''}`}>
                    {c === '.' ? '' : <span className="inline-block size-3 rounded-full bg-chord" />}
                  </td>
                ))}
              </tr>
            ))}
            {block.sticking && (
              <tr>
                <th className="pr-2 text-left font-normal text-muted-foreground">Mãos</th>
                {block.sticking.split(' ').map((s, i) => (
                  <td key={i} className="h-6 w-6 text-center font-semibold">
                    {s}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

/** Renders the blocks of a lesson; chords open the "how to play" card, examples play with the synth. */
export const LessonBlocks = ({ blocks, lessonId }: { blocks: Block[]; lessonId: string }) => {
  const synth = useStudySynth();
  const [help, setHelp] = useState<{ chord: string; anchor: DOMRect } | null>(null);
  const onHelp = (chord: string, anchor: DOMRect) => setHelp({ chord, anchor });
  return (
    <div className="max-w-3xl leading-relaxed">
      {blocks.map((b, i) => {
        const id = `${lessonId}-${i}`;
        switch (b.kind) {
          case 'text':
            return b.text.split('\n\n').map((p, k) => (
              <p key={`${i}-${k}`} className="my-3 text-muted-foreground">
                <Rich text={p} />
              </p>
            ));
          case 'list':
            return (
              <div key={i} className="my-3">
                {b.title && <p className="font-semibold">{b.title}</p>}
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground marker:text-chord">
                  {b.items.map((it, k) => (
                    <li key={k}>
                      <Rich text={it} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          case 'tip':
            return (
              <p key={i} className={`my-4 flex gap-3 rounded-xl border p-3 text-sm ${b.tone === 'warning' ? 'border-amber-500/50 bg-amber-500/10' : 'border-primary/40 bg-primary/10'}`}>
                {b.tone === 'warning' ? <TriangleAlert className="size-5 shrink-0 text-amber-500" /> : <Lightbulb className="size-5 shrink-0 text-chord" />}
                <span>
                  <Rich text={b.text} />
                </span>
              </p>
            );
          case 'chords':
            return (
              <Card key={i} title={b.caption}>
                <ChordChips chords={b.chords} onHelp={onHelp} />
                <p className="mt-2 text-xs text-muted-foreground">Toque num acorde para ver como tocar.</p>
              </Card>
            );
          case 'progression':
            return <ProgressionBlock key={i} block={b} id={id} synth={synth} onHelp={onHelp} />;
          case 'scale':
            return <ScaleBlock key={i} block={b} id={id} synth={synth} />;
          case 'intervals':
            return <IntervalsBlock key={i} block={b} id={id} synth={synth} />;
          case 'rhythm':
            return <RhythmBlock key={i} block={b} id={id} synth={synth} />;
          case 'tab':
            return (
              <Card key={i} title={b.caption}>
                <PlayButton active={synth.playing === id} onClick={() => synth.play(id, tabEvents(b.tab, b.bpm ?? 90))} label={b.caption ?? 'frase'} />
                <pre className="thin-scrollbar mt-3 overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs leading-5">{b.tab}</pre>
              </Card>
            );
          case 'exercise':
            return (
              <div key={i} className="my-4 rounded-xl border border-border p-4">
                <p className="font-semibold">{b.title ?? 'Pratique'}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground marker:font-semibold marker:text-chord">
                  {b.steps.map((s, k) => (
                    <li key={k}>
                      <Rich text={s} />
                    </li>
                  ))}
                </ol>
              </div>
            );
          default:
            return null;
        }
      })}
      {help && <ChordHelp chord={help.chord} anchor={help.anchor} onClose={() => setHelp(null)} strict />}
    </div>
  );
};

export { SOLFEGE };
