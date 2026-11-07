import { useEffect, useState } from 'react';
import { activeIndexAt } from './Player.tsx';

/**
 * The lyric line being sung and the next one, pinned under the header while the score is read.
 * Time arrives through `sink` (set by the page from the player), so only this strip re-renders.
 */
export const LyricTicker = ({ lines, sink }: { lines: readonly { time: number; text: string }[]; sink: React.RefObject<((t: number) => void) | null> }) => {
  const [index, setIndex] = useState(-1);
  useEffect(() => {
    const starts = lines.map((l) => l.time);
    sink.current = (t) => setIndex(activeIndexAt(starts, t));
    return () => {
      sink.current = null;
    };
  }, [lines, sink]);
  const current = lines[index]?.text;
  const next = lines.slice(index + 1).find((l) => l.text.trim())?.text;
  return (
    <div className="glass sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -mx-4 mt-3 border-y border-border px-4 py-2" aria-live="off">
      <p className="truncate text-lg font-semibold">{current?.trim() || '♪'}</p>
      {next && <p className="truncate text-sm text-muted-foreground">{next}</p>}
    </div>
  );
};
