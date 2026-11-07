import { Pause, Play, ScrollText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

type Props = {
  src: string;
  onTime: (t: number) => void;
  autoScroll?: boolean;
  onAutoScrollChange?: (on: boolean) => void;
};

export const Player = ({ src, onTime, autoScroll = true, onAutoScrollChange }: Props) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(100);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.preservesPitch = true;
    audio.playbackRate = speed / 100;
  }, [speed]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const t = audioRef.current?.currentTime ?? 0;
      setTime(t);
      onTime(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, onTime]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          onTime(e.currentTarget.currentTime);
        }}
      />
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
              if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
            }}
            className="flex-1 accent-[var(--primary)]"
          />
          <span>{clock(duration)}</span>
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
