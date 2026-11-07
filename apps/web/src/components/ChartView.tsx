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
  /** Editor mode: called with (lyric line index, plain character index) when a word is tapped. */
  onPick?: (lyricLineIndex: number, charIndex: number) => void;
};

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

export const ChartView = ({ chordPro, transpose, preferFlats, spellKey, fontSize, activeLineIndex = -1, autoScroll = false, onPick }: Props) => {
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
                <span key={j} className="text-chord">{t(c)}</span>
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
            className={`-ml-3 flex flex-wrap items-end border-l-[3px] py-1 pl-3 transition-colors ${active ? 'border-primary bg-muted' : 'border-transparent'}`}
          >
            {line.parts.map((part, j) => {
              const base = offset;
              offset += part.text.length;
              return (
                <span key={j} className="inline-flex flex-col">
                  <span className="min-h-[1.25em] pr-1 font-bold text-chord">{part.chord ? t(part.chord) : ' '}</span>
                  <span className="whitespace-pre">
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
