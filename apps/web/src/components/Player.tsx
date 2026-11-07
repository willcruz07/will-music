import { Pause, Play, ScrollText } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { normalizeLoop } from '../lib/loop.ts';
import { driftCorrections } from '../lib/mixer.ts';

export const activeIndexAt = (starts: readonly number[], t: number): number => {
  let lo = 0;
  let hi = starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid]! <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

const clock = (sec: number): string => {
  if (!Number.isFinite(sec)) return '0:00';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
};

export type PlayerSource = { name: string; src: string; volume: number };

type Props = {
  /** One file, or several synced tracks (the first is the master clock). */
  src?: string;
  sources?: PlayerSource[];
  onTime: (t: number) => void;
  autoScroll?: boolean;
  onAutoScrollChange?: (on: boolean) => void;
  /** Lets the page start playback from a position (sync mode). */
  controls?: React.RefObject<PlayerControls | null>;
};

export type PlayerControls = { playFrom: (t: number) => void; pause: () => void; currentTime: () => number };

export const Player = ({ src, sources, onTime, autoScroll = true, onAutoScrollChange, controls }: Props) => {
  const tracks: PlayerSource[] = sources ?? (src ? [{ name: 'mix', src, volume: 1 }] : []);
  const audioRef = useRef<HTMLAudioElement>(null);
  const followers = useRef<(HTMLAudioElement | null)[]>([]);
  const all = () => [audioRef.current, ...followers.current].filter((a): a is HTMLAudioElement => !!a);
  const seekAll = (t: number) => {
    for (const a of all()) a.currentTime = t;
  };
  useImperativeHandle(controls, () => ({
    playFrom: (t: number) => {
      seekAll(t);
      for (const a of all()) void a.play();
    },
    pause: () => {
      for (const a of all()) a.pause();
    },
    currentTime: () => audioRef.current?.currentTime ?? 0,
  }));
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(100);
  const [markA, setMarkA] = useState<number | null>(null);
  const [markB, setMarkB] = useState<number | null>(null);
  const loop = normalizeLoop(markA, markB, duration);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  // Called on every time update: jumps back to A once playback passes B.
  const follow = (t: number) => {
    const l = loopRef.current;
    if (l && t >= l.b) {
      seekAll(l.a);
      t = l.a;
    } else {
      // Keep the other tracks on the master clock.
      const others = followers.current.filter((a): a is HTMLAudioElement => !!a);
      driftCorrections(t, others.map((a) => a.currentTime)).forEach((fix, i) => {
        if (fix !== null) others[i]!.currentTime = fix;
      });
    }
    setTime(t);
    onTime(t);
  };
  const followRef = useRef(follow);
  followRef.current = follow;

  useEffect(() => {
    for (const a of all()) {
      a.preservesPitch = true;
      a.playbackRate = speed / 100;
    }
  }, [speed, tracks.length]);

  useEffect(() => {
    all().forEach((a, i) => (a.volume = tracks[i]?.volume ?? 1));
  });

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      followRef.current(audioRef.current?.currentTime ?? 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, onTime]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      seekAll(audio.currentTime);
      for (const a of all()) void a.play();
    } else for (const a of all()) a.pause();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <audio
        ref={audioRef}
        src={tracks[0]?.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => follow(e.currentTarget.currentTime)}
      />
      {tracks.slice(1).map((t, i) => (
        <audio key={t.name} ref={(el) => void (followers.current[i] = el)} src={t.src} preload="auto" />
      ))}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          {playing ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
        </button>
        <div className="flex min-w-48 flex-1 items-center gap-3 text-sm tabular-nums text-muted-foreground">
          <span>{clock(time)}</span>
          <input
            type="range"
            aria-label="Posição"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => {
              seekAll(Number(e.target.value));
            }}
            className="flex-1 accent-[var(--primary)]"
          />
          <span>{clock(duration)}</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <button type="button" onClick={() => setMarkA(audioRef.current?.currentTime ?? 0)} className={`rounded-lg px-2 py-2 ${markA !== null ? 'bg-muted font-semibold' : 'text-muted-foreground'}`} aria-label="Marcar A">
            A
          </button>
          <button type="button" onClick={() => setMarkB(audioRef.current?.currentTime ?? 0)} className={`rounded-lg px-2 py-2 ${markB !== null ? 'bg-muted font-semibold' : 'text-muted-foreground'}`} aria-label="Marcar B">
            B
          </button>
          {loop && <span className="tabular-nums text-chord">Loop {clock(loop.a)}–{clock(loop.b)}</span>}
          {(markA !== null || markB !== null) && (
            <button
              type="button"
              onClick={() => {
                setMarkA(null);
                setMarkB(null);
              }}
              className="rounded-lg px-2 py-2 text-muted-foreground hover:bg-muted"
            >
              Limpar loop
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-10 text-right tabular-nums">{speed}%</span>
          <input
            type="range"
            aria-label="Velocidade"
            min={50}
            max={150}
            step={5}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-28 accent-[var(--primary)]"
          />
        </label>
        <button
          type="button"
          aria-pressed={autoScroll}
          onClick={() => onAutoScrollChange?.(!autoScroll)}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm ${autoScroll ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
        >
          <ScrollText className="size-4" /> Rolagem
        </button>
      </div>
    </div>
  );
};
