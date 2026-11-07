import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { chordNotes } from '../lib/chordNotation.ts';
import { type SynthEvent, createScoreSynth } from '../lib/synth.ts';

/** Keyboard of two octaves with the given pitch classes lit (the first one marked as the tonic). */
export const ScaleKeyboard = ({ pcs, label = 'Notas no teclado' }: { pcs: number[]; label?: string }) => {
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const BLACK: Record<number, number> = { 1: 0.65, 3: 1.75, 6: 3.6, 8: 4.7, 10: 5.8 };
  const lit = new Set(pcs);
  const tonic = pcs[0];
  const w = 22;
  return (
    <svg viewBox={`0 0 ${14 * w} 96`} className="w-full max-w-xl" role="img" aria-label={label}>
      {[0, 1].map((o) =>
        WHITE.map((pc, i) => (
          <rect key={`w${o}${pc}`} x={(o * 7 + i) * w} y={0} width={w - 1} height={94} rx={3} fill={pc === tonic ? 'var(--primary)' : lit.has(pc) ? 'var(--chord)' : 'var(--surface)'} stroke="var(--border)" />
        )),
      )}
      {[0, 1].map((o) =>
        Object.entries(BLACK).map(([pcText, x]) => {
          const pc = Number(pcText);
          return <rect key={`b${o}${pc}`} x={(o * 7 + x) * w} y={0} width={w * 0.62} height={58} rx={2} fill={pc === tonic ? 'var(--primary)' : lit.has(pc) ? 'var(--chord)' : 'var(--foreground)'} stroke="var(--border)" />;
        }),
      )}
    </svg>
  );
};

const STANDARD_LOW_FIRST = [40, 45, 50, 55, 59, 64];

/** Guitar neck (frets 0–15) with every note of the pitch-class set; the root is filled, the box (if any) framed. */
export const Fretboard = ({ pcs, root, box, tuning = STANDARD_LOW_FIRST }: { pcs: number[]; root: number; box?: number; tuning?: readonly number[] }) => {
  const frets = 15;
  const fw = 34;
  const sh = 18;
  const left = 22;
  const top = 14;
  const set = new Set(pcs);
  const strings = [...tuning].reverse(); // high string on top, like the tab
  return (
    <div className="no-scrollbar overflow-x-auto">
      <svg viewBox={`0 0 ${left + frets * fw + 10} ${top + (strings.length - 1) * sh + 26}`} className="min-w-[34rem]" role="img" aria-label="Notas da escala no braço do violão">
        {box !== undefined && <rect x={left + Math.max(0, box - 1) * fw} y={top - 9} width={fw * (box === 0 ? 4.5 : 4)} height={(strings.length - 1) * sh + 18} rx={8} fill="color-mix(in oklab, var(--glow) 12%, transparent)" />}
        {Array.from({ length: frets + 1 }, (_, f) => (
          <line key={f} x1={left + f * fw} y1={top} x2={left + f * fw} y2={top + (strings.length - 1) * sh} stroke="var(--border)" strokeWidth={f === 0 ? 4 : 1.5} />
        ))}
        {strings.map((_, s) => (
          <line key={s} x1={left} y1={top + s * sh} x2={left + frets * fw} y2={top + s * sh} stroke="var(--muted-foreground)" strokeOpacity={0.6} strokeWidth={1 + s * 0.25} />
        ))}
        {[3, 5, 7, 9, 12, 15].map((f) => (
          <text key={f} x={left + (f - 0.5) * fw} y={top + (strings.length - 1) * sh + 20} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
            {f}
          </text>
        ))}
        {strings.map((open, s) =>
          Array.from({ length: frets + 1 }, (_, f) => {
            const pc = (open + f) % 12;
            if (!set.has(pc)) return null;
            const x = f === 0 ? left - 10 : left + (f - 0.5) * fw;
            return <circle key={`${s}-${f}`} cx={x} cy={top + s * sh} r={6.5} fill={pc === root ? 'var(--primary)' : 'var(--surface)'} stroke="var(--chord)" strokeWidth={2} />;
          }),
        )}
      </svg>
    </div>
  );
};

/** A voicing for a chord to play: bass an octave low, chord tones around middle C. */
export const chordEvents = (chords: string[], bpm = 80, beats = 4): SynthEvent[] => {
  const bar = (60 / bpm) * beats;
  return chords.flatMap((chord, i) => {
    const pcs = chordNotes(chord);
    if (!pcs) return [];
    const bass = 36 + pcs[0]!;
    let note = 52;
    const upper = pcs.map((pc) => {
      while ((note % 12 + 12) % 12 !== pc) note++;
      const out = note;
      note++;
      return out;
    });
    return [{ time: i * bar, dur: bar * 0.95, pitch: bass }, ...upper.map((p) => ({ time: i * bar, dur: bar * 0.9, pitch: p }))];
  });
};

/** One synth per page; a new example stops the previous one. Created inside the tap (iOS needs that). */
export const useStudySynth = () => {
  const synth = useRef<ReturnType<typeof createScoreSynth> | null>(null);
  const timer = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      synth.current?.dispose();
    },
    [],
  );
  const stop = () => {
    clearTimeout(timer.current);
    synth.current?.stop();
    setPlaying(null);
  };
  const play = (id: string, events: SynthEvent[]) => {
    if (playing === id) return stop();
    synth.current ??= createScoreSynth();
    synth.current.unlock();
    synth.current.setVolume(0.8);
    synth.current.setEvents(events);
    synth.current.play(0, 1);
    setPlaying(id);
    const end = Math.max(0, ...events.map((e) => e.time + e.dur));
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      synth.current?.stop();
      setPlaying(null);
    }, (end + 0.4) * 1000);
  };
  return { play, stop, playing };
};

export const PlayButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={active ? `Parar: ${label}` : `Tocar: ${label}`}
    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
  >
    {active ? <Pause className="size-4" /> : <Play className="size-4" />} {active ? 'Parar' : 'Ouvir'}
  </button>
);
