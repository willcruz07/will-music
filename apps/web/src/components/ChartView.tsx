import { useEffect, useMemo, useRef } from 'react';
import { parseChordPro } from '../lib/chart.ts';
import { transposeChord } from '../lib/transpose.ts';

type Props = {
  chordPro: string;
  transpose: number;
  preferFlats: boolean;
  fontSize: number;
  /** Index among lyric lines (the k-th lyric line of the chart ↔ the k-th lyric line of the analysis). */
  activeLineIndex?: number;
  /** Key the chart is shown in; when given, chord spelling follows it. */
  spellKey?: string;
  autoScroll?: boolean;
  /** Studio uses a quiet margin marker instead of painting the whole line. */
  highlight?: 'background' | 'marker';
  /** Editor mode: called with (lyric line index, plain character index) when a word is tapped. */
  onPick?: (lyricLineIndex: number, charIndex: number) => void;
  /** Reading mode: called with the shown chord when it is tapped (to show how to play it). */
  onChordTap?: (chord: string, anchor: DOMRect) => void;
};

/** A chord name; a button when it can be tapped for help. */
const Chord = ({ name, onTap }: { name: string; onTap?: (chord: string, anchor: DOMRect) => void }) =>
  onTap ? (
    <button
      type="button"
      onClick={(e) => onTap(name, e.currentTarget.getBoundingClientRect())}
      aria-label={`Como tocar ${name}`}
      className="rounded font-bold text-chord underline decoration-chord/30 decoration-dotted underline-offset-4 hover:bg-muted hover:decoration-chord"
    >
      {name}
    </button>
  ) : (
    <span className="font-bold text-chord">{name}</span>
  );

const Words = ({ text, offset, onPick }: { text: string; offset: number; onPick: (charIndex: number) => void }) => {
  let at = offset;
  return (
    <>
      {text.split(/(\s+)/u).map((token, i) => {
        const start = at;
        at += token.length;
        if (!token.trim()) return <span key={i}>{token}</span>;
        return (
          <span key={i} role="button" tabIndex={0} onClick={() => onPick(start)} onKeyDown={(e) => e.key === 'Enter' && onPick(start)} className="cursor-pointer rounded hover:bg-muted focus-visible:bg-muted">
            {token}
          </span>
        );
      })}
    </>
  );
};

export const ChartView = ({ chordPro, transpose, preferFlats, spellKey, fontSize, activeLineIndex = -1, autoScroll = false, highlight = 'background', onPick, onChordTap }: Props) => {
  const { lines } = useMemo(() => parseChordPro(chordPro), [chordPro]);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const t = (chord: string) => transposeChord(chord, transpose, spellKey ?? preferFlats);

  useEffect(() => {
    if (autoScroll && activeRef.current) activeRef.current.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [activeLineIndex, autoScroll]);

  let lyricIndex = -1;
  return (
    <div className="max-w-[68ch] leading-tight" style={{ fontSize }}>
      {lines.map((line, i) => {
        if (line.kind === 'comment') {
          return (
            <p key={i} className="mb-1 mt-6 text-[0.8em] font-semibold text-muted-foreground first:mt-0">
              {line.text}
            </p>
          );
        }
        if (line.kind === 'chords') {
          return (
            <div key={i} className="mb-2 flex flex-wrap gap-x-5 gap-y-1 font-bold text-chord">
              {line.chords.map((c, j) => (
                <Chord key={j} name={t(c)} onTap={onChordTap} />
              ))}
            </div>
          );
        }
        lyricIndex += 1;
        const active = lyricIndex === activeLineIndex;
        const lineIndex = lyricIndex;
        let offset = 0;
        return (
          <div
            key={i}
            data-line
            data-active={active ? 'true' : 'false'}
            ref={active ? activeRef : undefined}
            className={`-ml-3 flex flex-wrap items-end rounded-r-lg py-1 pl-3 transition-[background,box-shadow] duration-300 ${active ? highlight === 'marker' ? 'now-playing-marker' : 'now-playing' : ''}`}
          >
            {line.parts.map((part, j) => {
              const base = offset;
              offset += part.text.length;
              return (
                <span key={j} className="inline-flex max-w-full flex-col">
                  <span className="min-h-[1.25em] pr-1 font-bold text-chord">{part.chord ? <Chord name={t(part.chord)} onTap={onChordTap} /> : ' '}</span>
                  <span className="whitespace-pre-wrap break-words">
                    {onPick ? <Words text={part.text} offset={base} onPick={(c) => onPick(lineIndex, c)} /> : part.text}
                  </span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
