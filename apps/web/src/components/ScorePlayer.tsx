import { Pause, Play, SkipBack } from 'lucide-react';
import { type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Grid } from '@will-music/engine';
import { formatClock, scoreWholeAt, stepAt } from '../lib/scorePlayback.ts';
import { type SynthEvent, createScoreSynth } from '../lib/synth.ts';
import type { PlayerControls } from './Player.tsx';
import type { ScoreCursor } from './ScoreView.tsx';

/** What the song page tells the score player about the song player below (time and play/pause). */
export type ScorePlayerHandle = { songTime: (t: number) => void; songTransport: (playing: boolean) => void };

type Mode = 'score' | 'song';
const SPEEDS = [0.5, 0.75, 1, 1.25];

/**
 * The score's own player, on top of the sheet (like MuseScore's): it plays the notes of the part on screen and an
 * emerald cursor walks over the score as they sound. "Só a partitura" plays the notes alone at its own speed;
 * "Com a música" drives the song player below and the cursor follows the song. The cursor also follows the song
 * whenever the player below is used.
 */
export const ScorePlayer = ({
  events,
  grid,
  skipTicks,
  cursorRef,
  songPlayer,
  handle,
  onWithMusic,
  scoreOnly = false,
}: {
  events: SynthEvent[];
  grid: Grid;
  skipTicks: number;
  cursorRef: MutableRefObject<ScoreCursor | null>;
  songPlayer: MutableRefObject<PlayerControls | null>;
  handle: MutableRefObject<ScorePlayerHandle | null>;
  /** Turns the score notes on along with the song (runs inside the tap, for iOS audio). */
  onWithMusic: () => void;
  scoreOnly?: boolean;
}) => {
  const [mode, setMode] = useState<Mode>('score');
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const synth = useRef<ReturnType<typeof createScoreSynth> | null>(null);
  const posRef = useRef(0);
  const lastStep = useRef(-2);
  const lastShown = useRef(0);
  const end = useMemo(() => events.reduce((m, e) => Math.max(m, e.time + e.dur), 0), [events]);
  const start = events[0]?.time ?? 0;

  // Moves the cursor onto the step sounding at song time t (only when the step changes) and updates the clock.
  const follow = useCallback(
    (t: number, force = false) => {
      posRef.current = t;
      const cursor = cursorRef.current;
      if (cursor?.steps.length) {
        const step = Math.max(0, stepAt(cursor.steps, scoreWholeAt(t, grid, skipTicks)));
        if (step !== lastStep.current || force) {
          lastStep.current = step;
          cursor.moveTo(step);
        }
      }
      const now = performance.now();
      if (force || now - lastShown.current > 250) {
        lastShown.current = now;
        setPos(t);
      }
    },
    [cursorRef, grid, skipTicks],
  );

  const stopScore = useCallback(() => {
    synth.current?.stop();
    setPlaying(false);
  }, []);

  // Alone: the synth is the clock; the cursor reads its position every frame and stops at the last note.
  useEffect(() => {
    if (!playing || mode !== 'score') return;
    let frame = 0;
    const tick = () => {
      const t = synth.current?.position();
      if (t === null || t === undefined) return;
      if (t > end + 0.3) {
        stopScore();
        follow(end, true);
        return;
      }
      follow(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, mode, end, follow, stopScore]);

  useEffect(() => synth.current?.setEvents(events), [events]);
  useEffect(() => synth.current?.setVolume(volume), [volume]);
  useEffect(
    () => () => {
      synth.current?.dispose();
      synth.current = null;
    },
    [],
  );

  // The song player below: its time moves the cursor; playing it takes over from the notes played alone.
  useEffect(() => {
    handle.current = {
      songTime: (t) => follow(t),
      songTransport: (isPlaying) => {
        if (mode === 'song') {
          setPlaying(isPlaying);
          return;
        }
        // Alone: only the song starting matters (it takes over); its pause, sent when this player starts, does not.
        if (isPlaying) {
          synth.current?.stop();
          setPlaying(false);
        }
      },
    };
    return () => {
      handle.current = null;
    };
  }, [handle, follow, mode]);

  const from = () => (posRef.current >= end - 0.05 || posRef.current < start - 1 ? Math.max(0, start - 0.5) : posRef.current);

  const play = () => {
    if (mode === 'song') {
      onWithMusic();
      songPlayer.current?.playFrom(from());
      setPlaying(true);
      return;
    }
    songPlayer.current?.pause();
    synth.current ??= createScoreSynth();
    synth.current.unlock();
    synth.current.setVolume(volume);
    synth.current.setEvents(events);
    synth.current.play(from(), speed);
    setPlaying(true);
  };

  const pause = () => {
    if (mode === 'song') songPlayer.current?.pause();
    else stopScore();
    setPlaying(false);
    setPos(posRef.current);
  };

  const seek = (t: number) => {
    follow(t, true);
    if (!playing) return;
    if (mode === 'song') songPlayer.current?.playFrom(t);
    else synth.current?.play(t, speed);
  };

  const chooseMode = (next: Mode) => {
    if (next === mode) return;
    pause();
    setMode(next);
  };

  const chooseSpeed = (next: number) => {
    setSpeed(next);
    if (playing && mode === 'score') synth.current?.play(posRef.current, next);
  };

  return (
    <div
      role="region"
      aria-label="Player da partitura"
      className="glass sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 mt-4 rounded-xl border border-border px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={playing ? pause : play}
          aria-label={playing ? 'Pausar a partitura' : 'Tocar a partitura'}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:brightness-105"
        >
          {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
        </button>
        <button
          type="button"
          onClick={() => seek(Math.max(0, start - 0.5))}
          aria-label="Voltar ao início"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <SkipBack className="size-4" />
        </button>
        <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{formatClock(pos)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.ceil(end))}
          step={0.1}
          value={Math.min(pos, end)}
          aria-label="Posição na partitura"
          onChange={(e) => seek(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[var(--primary)]"
        />
        <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{formatClock(end)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {!scoreOnly && <div role="radiogroup" aria-label="O que tocar" className="inline-flex rounded-lg border border-border p-0.5">
          {(
            [
              ['score', 'Só a partitura'],
              ['song', 'Com a música'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => chooseMode(value)}
              className={`min-h-8 rounded-md px-3 text-xs ${mode === value ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>}
        {mode === 'score' ? (
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Velocidade
            <select value={speed} onChange={(e) => chooseSpeed(Number(e.target.value))} className="min-h-8 rounded-md border border-border bg-surface px-1.5 text-foreground">
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {Math.round(s * 100)}%
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">Velocidade e loop: no player da música, embaixo.</span>
        )}
        {mode === 'score' && (
          <label className="inline-flex flex-1 items-center gap-2 text-xs text-muted-foreground sm:max-w-48">
            Volume
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              aria-label="Volume da partitura"
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="min-w-0 flex-1 accent-[var(--primary)]"
            />
          </label>
        )}
      </div>
    </div>
  );
};
