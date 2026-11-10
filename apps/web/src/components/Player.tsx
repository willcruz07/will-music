import { ChevronDown, ChevronUp, Pause, Play, Repeat, ScrollText, X, SkipBack, SkipForward, Square } from 'lucide-react';
import { type ReactNode, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { normalizeLoop } from '../lib/loop.ts';
import { driftCorrections } from '../lib/mixer.ts';
import { getPeaks } from '../lib/peaks.ts';
import type { StemsState } from '../lib/useStems.ts';
import { StemsPanel } from './player/StemsPanel.tsx';
import { Waveform } from './player/Waveform.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { BottomSheet } from '../ui/BottomSheet.tsx';

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
export type ScrollMode = 'follow' | 'steady';
export type Transport = { playing: boolean; time: number; rate: number };

type Props = {
  /** Studio shares the same audio engine, with transport and waveform at the top. */
  studio?: { artist: string; tempo?: number; keyLabel?: string };
  deferWaveform?: boolean;
  /** One file, or several synced tracks (the first is the master clock). */
  src?: string;
  sources?: PlayerSource[];
  onTime: (t: number) => void;
  title?: string;
  /** Enables the waveform and remembers the position for this song across screens. */
  songId?: string;
  autoScroll?: boolean;
  onAutoScrollChange?: (on: boolean) => void;
  scrollMode?: ScrollMode;
  onScrollModeChange?: (mode: ScrollMode) => void;
  scrollSpeed?: number;
  onScrollSpeedChange?: (speed: number) => void;
  /** Stem separation and mixer, shown in the drawer. */
  stems?: StemsState;
  /** More drawer content from the page (e.g. the score's own sound). */
  extra?: ReactNode;
  /** Play/pause/seek/speed changes, for anything that must follow the music (the score synth). */
  onTransport?: (t: Transport) => void;
  /** Lets the page start playback from a position (sync mode). */
  controls?: React.RefObject<PlayerControls | null>;
};

export type PlayerControls = { playFrom: (t: number) => void; pause: () => void; currentTime: () => number; playing: () => boolean; rate: () => number };

const positionKey = (songId: string) => `wm-pos:${songId}`;
const readPosition = (songId?: string) => {
  if (!songId) return null;
  try {
    const v = Number(sessionStorage.getItem(positionKey(songId)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-border px-4 py-3 first:border-t-0">
    <h2 className="mb-2 text-xs font-semibold text-muted-foreground">{title}</h2>
    {children}
  </section>
);

const SPEEDS = [50, 75, 90, 100];
const PlayerDrawer = ({ studio, id, onClose, children }: { studio: boolean; id: string; onClose: () => void; children: ReactNode }) => studio
  ? <BottomSheet title="BPM, tom e leitura" onClose={onClose}>{() => <div id={id} className="overflow-y-auto">{children}</div>}</BottomSheet>
  : <div id={id} className="mx-auto max-h-[min(62dvh,36rem)] max-w-5xl overflow-y-auto overscroll-contain border-b border-border">{children}</div>;

export const Player = (props: Props) => {
  const { src, sources, onTime, title, songId, autoScroll = true, onAutoScrollChange, stems, extra, controls } = props;
  const tracks: PlayerSource[] = sources ?? (src ? [{ name: 'mix', src, volume: 1 }] : []);
  const audioRef = useRef<HTMLAudioElement>(null);
  const followers = useRef<(HTMLAudioElement | null)[]>([]);
  const all = () => [audioRef.current, ...followers.current].filter((a): a is HTMLAudioElement => !!a);
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(100);
  const baseBpm = props.studio?.tempo;
  const bpmMode = !!props.studio;
  const currentBpm = baseBpm ? Math.round(baseBpm * speed / 100) : undefined;
  const [markA, setMarkA] = useState<number | null>(null);
  const [markB, setMarkB] = useState<number | null>(null);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const selectedLoop = normalizeLoop(markA, markB, duration);
  const loop = loopEnabled ? selectedLoop : null;
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const transportRef = useRef(props.onTransport);
  transportRef.current = props.onTransport;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const notify = (isPlaying: boolean, t = audioRef.current?.currentTime ?? 0) => transportRef.current?.({ playing: isPlaying, time: t, rate: speedRef.current / 100 });

  const seekAll = (t: number) => {
    for (const a of all()) a.currentTime = t;
    lastTime.current = t;
    setTime(t);
    onTime(t);
    if (audioRef.current && !audioRef.current.paused) notify(true, t);
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
    playing: () => !!audioRef.current && !audioRef.current.paused,
    rate: () => speedRef.current / 100,
  }));

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
    lastTime.current = t;
    setTime(t);
    onTime(t);
  };
  const followRef = useRef(follow);
  followRef.current = follow;

  // Switching between the original file and the separated tracks reloads the master: keep the
  // position, speed and play state across the reload. The first load resumes where this song was left.
  const lastTime = useRef(0);
  const wasPlaying = useRef(false);
  wasPlaying.current = playing;
  const sourceKey = tracks.map((t) => t.src).join('|');
  const resumeAt = useRef<number | null | undefined>(undefined);
  if (resumeAt.current === undefined) resumeAt.current = readPosition(songId);
  const loadedOnce = useRef(false);
  const resumePlaying = useRef(false);
  const previousKey = useRef(sourceKey);
  if (previousKey.current !== sourceKey) {
    previousKey.current = sourceKey;
    // A position still waiting for the first load (the one saved for this song) wins over 0.
    if (resumeAt.current === null) {
      resumeAt.current = lastTime.current;
      resumePlaying.current = wasPlaying.current;
    }
  }

  useEffect(() => {
    if (!songId) return;
    const save = () => {
      if (!loadedOnce.current) return; // never loaded: keep what was saved before
      try {
        sessionStorage.setItem(positionKey(songId), String(lastTime.current));
      } catch {
        /* per-tab convenience only */
      }
    };
    window.addEventListener('pagehide', save);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
    };
  }, [songId]);

  const applyRate = () => {
    for (const a of all()) {
      a.preservesPitch = true;
      a.playbackRate = speed / 100;
    }
  };
  useEffect(() => {
    applyRate();
    if (audioRef.current && !audioRef.current.paused) notify(true);
  }, [speed, sourceKey]);

  useEffect(() => {
    all().forEach((a, i) => {
      const volume = tracks[i]?.volume ?? 1;
      a.volume = volume;
      // iOS ignores volume: muting is what silences a track there.
      a.muted = volume === 0;
    });
  });

  // The waveform is drawn only once the drawer has been opened (decoding costs a moment).
  useEffect(() => {
    if ((!open && !props.studio) || peaks || !songId || props.deferWaveform) return;
    let cancelled = false;
    void getPeaks(songId)
      .then((p) => {
        if (!cancelled && p) setPeaks(p.peaks);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, peaks, songId, !!props.studio, props.deferWaveform]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onMasterLoaded = (audio: HTMLAudioElement) => {
    setDuration(audio.duration);
    loadedOnce.current = true;
    if (resumeAt.current === null || resumeAt.current === undefined) return;
    const t = Math.min(resumeAt.current, Number.isFinite(audio.duration) ? audio.duration : resumeAt.current);
    resumeAt.current = null;
    seekAll(t);
    lastTime.current = t;
    setTime(t);
    onTime(t);
    applyRate();
    if (resumePlaying.current) for (const a of all()) void a.play();
  };

  // Followers mirror the master's pauses and stalls (buffering, audio focus loss, Bluetooth).
  const mirrorPause = () => {
    for (const a of followers.current) a?.pause();
  };
  const mirrorPlay = () => {
    const master = audioRef.current;
    if (!master) return;
    for (const a of followers.current) {
      if (!a) continue;
      a.currentTime = master.currentTime;
      void a.play();
    }
  };

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

  const clearLoop = () => {
    setMarkA(null);
    setMarkB(null);
  };

  return (
    <>
    {/* While the controls are open the page behind dims and blurs, like the other sheets; a tap on it closes them. */}
    {open && !props.studio && <div data-testid="player-backdrop" aria-hidden onClick={() => setOpen(false)} className="sheet-backdrop fixed inset-0 z-[29] bg-black/55 backdrop-blur-sm" />}
    {/* Phones: the chart fades out behind the floating player and the bottom bar instead of showing in the gap. */}
    {!props.studio && <div aria-hidden className="player-slide pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(var(--nav-height)+env(safe-area-inset-bottom)+7.5rem)] bg-gradient-to-t from-background via-background/95 to-transparent lg:hidden" />}
    <div className={props.studio ? 'studio-player glass rounded-2xl border border-border p-4 md:p-5' : 'glass-strong player-slide fixed inset-x-3 z-30 overflow-hidden rounded-2xl border border-border shadow-[0_12px_40px_-16px_rgb(0_0_0/0.45)] bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom)+1.25rem)] lg:inset-x-0 lg:bottom-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:pb-[env(safe-area-inset-bottom)]'}>
      <audio
        ref={audioRef}
        src={tracks[0]?.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPlaying={() => {
          mirrorPlay();
          notify(true);
        }}
        onPause={() => {
          setPlaying(false);
          mirrorPause();
          notify(false);
        }}
        onWaiting={() => {
          mirrorPause();
          notify(false);
        }}
        onEmptied={() => {
          setPlaying(false);
          notify(false);
        }}
        onEnded={() => {
          // A loop that reaches the end of the song: the element stops before passing B, so restart A here.
          const l = loopRef.current;
          if (!l) return;
          seekAll(l.a);
          for (const a of all()) void a.play();
        }}
        onLoadedMetadata={(e) => onMasterLoaded(e.currentTarget)}
        onTimeUpdate={(e) => follow(e.currentTarget.currentTime)}
      />
      {tracks.slice(1).map((t, i) => (
        <audio key={t.name} ref={(el) => void (followers.current[i] = el)} src={t.src} preload="auto" />
      ))}

      {open && (
        <PlayerDrawer studio={!!props.studio} id={drawerId} onClose={() => setOpen(false)}>
          <Section title={props.studio ? 'Velocidade' : 'Treinar um trecho'}>
            {songId && !props.studio && (
              <Waveform
                peaks={peaks}
                duration={duration}
                time={time}
                loop={loop}
                onSeek={seekAll}
                onSelect={(a, b) => {
                  setMarkA(a);
                  setMarkB(b);
                  seekAll(a);
                }}
              />
            )}
            <p className={props.studio ? 'hidden' : 'mt-1 text-xs text-muted-foreground'}>
              {songId ? 'Arraste sobre a onda para marcar o trecho que vai repetir, ou use A e B enquanto toca.' : 'Marque o início (A) e o fim (B) do trecho que vai repetir.'}
            </p>
            <div className={props.studio ? 'hidden' : 'mt-2 flex flex-wrap items-center gap-1 text-sm'}>
              <button type="button" onClick={() => setMarkA(audioRef.current?.currentTime ?? 0)} className={`min-h-9 rounded-lg px-3 ${markA !== null ? 'bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted'}`} aria-label="Marcar A">
                A
              </button>
              <button type="button" onClick={() => setMarkB(audioRef.current?.currentTime ?? 0)} className={`min-h-9 rounded-lg px-3 ${markB !== null ? 'bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted'}`} aria-label="Marcar B">
                B
              </button>
              {loop && <span className="px-1 tabular-nums text-chord">Loop {clock(loop.a)}–{clock(loop.b)}</span>}
              {(markA !== null || markB !== null) && (
                <button type="button" onClick={clearLoop} className="min-h-9 rounded-lg px-3 text-muted-foreground hover:bg-muted">
                  Limpar loop
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">{bpmMode ? 'Andamento estimado' : 'Velocidade'}</span>
              <input
                type="range"
                aria-label={bpmMode ? 'Andamento em BPM' : 'Velocidade'}
                min={bpmMode && baseBpm ? Math.round(baseBpm * 0.5) : 50}
                max={bpmMode && baseBpm ? Math.round(baseBpm * 1.5) : 150}
                step={bpmMode ? 1 : 5}
                value={bpmMode && baseBpm ? currentBpm : speed}
                disabled={bpmMode && !baseBpm}
                onChange={(e) => setSpeed(bpmMode && baseBpm ? Number(e.target.value) / baseBpm * 100 : Number(e.target.value))}
                className="min-w-32 flex-1 accent-[var(--primary)]"
              />
              <span className="min-w-11 text-right tabular-nums">{bpmMode ? currentBpm ? `≈ ${currentBpm} BPM` : 'BPM…' : `${speed}%`}</span>
              <span className="flex gap-1">
                {SPEEDS.map((s) => (
                  <button key={s} type="button" disabled={bpmMode && !baseBpm} onClick={() => setSpeed(s)} className={`min-h-9 rounded-lg px-2.5 text-xs disabled:opacity-40 ${Math.round(speed) === s ? 'bg-primary/15 font-semibold text-chord' : 'text-muted-foreground hover:bg-muted'}`}>
                    {bpmMode ? baseBpm ? `≈ ${Math.round(baseBpm * s / 100)} BPM` : '—' : `${s}%`}
                  </button>
                ))}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{bpmMode ? baseBpm ? `Andamento original: ≈ ${baseBpm} BPM. A velocidade muda sem alterar o tom do áudio.` : 'Aguardando uma estimativa de andamento. Se não for identificada, informe o BPM nos dados da música.' : 'Mais devagar sem mudar o tom.'}</p>
          </Section>

          {onAutoScrollChange && (
            <Section title="Rolagem">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={autoScroll} onChange={(e) => onAutoScrollChange(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                Rolagem automática
              </label>
              {autoScroll && props.onScrollModeChange && (
                <div className="mt-2 space-y-2 text-sm">
                  <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" onKeyDown={rovingKeys} aria-label="Como rolar">
                    {(
                      [
                        ['follow', 'Acompanhar a música'],
                        ['steady', 'Rolagem contínua'],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={props.scrollMode === mode}
                        onClick={() => props.onScrollModeChange?.(mode)}
                        className={`rounded-md px-3 py-1.5 ${props.scrollMode === mode ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {props.scrollMode === 'steady' && (
                    <label className="flex items-center gap-3">
                      <span>Velocidade da rolagem</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={props.scrollSpeed ?? 3}
                        aria-label="Velocidade da rolagem"
                        onChange={(e) => props.onScrollSpeedChange?.(Number(e.target.value))}
                        className="flex-1 accent-[var(--primary)]"
                      />
                      <span className="w-6 text-right tabular-nums">{props.scrollSpeed ?? 3}</span>
                    </label>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {props.scrollMode === 'steady' ? 'A cifra desce sozinha enquanto a música toca, na velocidade escolhida.' : 'A cifra segue a linha que está tocando.'}
                  </p>
                </div>
              )}
            </Section>
          )}

          {stems && (
            <Section title="Faixas">
              <StemsPanel stems={stems} title={title ?? ''} hasAudio={tracks.length > 0} />
            </Section>
          )}

          {extra}
        </PlayerDrawer>
      )}

      {props.studio ? <>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="min-w-0"><h1 className="truncate text-xl font-bold">{title}</h1><p className="studio-player-artist truncate text-sm text-muted-foreground">{props.studio.artist || 'Artista desconhecido'}</p></div>
          <div className="col-span-2 col-start-1 row-start-2 flex items-center justify-center gap-2 md:col-span-1 md:col-start-2 md:row-start-1">
            <button type="button" className="studio-icon" aria-label="Voltar dez segundos" onClick={() => seekAll(Math.max(0, time - 10))}><SkipBack className="size-5" /></button>
            <button type="button" onClick={toggle} aria-label={playing ? 'Pausar' : 'Tocar'} className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">{playing ? <Pause /> : <Play />}</button>
            <button type="button" className="studio-icon" aria-label="Parar" onClick={() => { all().forEach(a => a.pause()); seekAll(0); }}><Square className="size-4" /></button>
            <button type="button" className="studio-icon" aria-label="Avançar dez segundos" onClick={() => seekAll(Math.min(duration, time + 10))}><SkipForward className="size-5" /></button>
            <button type="button" className="studio-icon" aria-label="Loop A–B" aria-pressed={!!loop} onClick={() => { if (selectedLoop) setLoopEnabled(v => !v); else { setMarkA(0); setMarkB(duration || null); setLoopEnabled(true); } }}><Repeat className={`size-5 ${loop ? 'text-primary' : ''}`} /></button>
          </div>
          <button type="button" className="col-start-2 row-start-1 flex min-h-11 w-max flex-nowrap items-baseline justify-end justify-self-end gap-4 bg-transparent text-chord hover:text-primary md:col-start-3" aria-label="BPM e tom" aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen(true)}>
            <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl">{currentBpm ? `≈ ${currentBpm}` : '—'}</span>
              <span className="font-sans text-xs text-muted-foreground">BPM</span>
            </span>
            <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
              <span className="font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl">{props.studio.keyLabel || '—'}</span>
              <span className="font-sans text-xs text-muted-foreground">Tom</span>
            </span>
          </button>
        </div>
        {songId && <div className="studio-player-wave mt-5"><Waveform peaks={peaks} duration={duration} time={time} loop={selectedLoop} onSeek={seekAll} onSelect={(a, b) => { setMarkA(a); setMarkB(b); setLoopEnabled(true); seekAll(a); }} /></div>}
        <input type="range" aria-label="Posição" min={0} max={duration || 0} step={0.1} value={time} onChange={e => seekAll(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs tabular-nums text-muted-foreground"><span>{clock(time)} / {clock(duration)}</span>{selectedLoop ? <button type="button" onClick={clearLoop}>A {clock(selectedLoop.a)} — B {clock(selectedLoop.b)} · Limpar trecho</button> : <span>Arraste na onda para repetir um trecho</span>}</div>
      </> : <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 md:px-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pausar' : 'Tocar'}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_18px_-6px_var(--primary)]"
        >
          {playing ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-foreground">{title}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {clock(time)} / {clock(duration)}
            </span>
          </div>
          <input
            type="range"
            aria-label="Posição"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => seekAll(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--primary)]"
          />
        </div>
        {loop && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-glow/15 px-2 py-1 text-xs tabular-nums text-glow sm:inline-flex">
            <Repeat className="size-3.5" /> {clock(loop.a)}–{clock(loop.b)}
            <button type="button" onClick={clearLoop} aria-label="Tirar o loop" className="-mr-1 ml-0.5 rounded-full p-0.5 hover:bg-glow/20">
              <X className="size-3" />
            </button>
          </span>
        )}
        {loop && <Repeat className="size-4 shrink-0 text-glow sm:hidden" aria-label="Loop ligado" />}
        {speed !== 100 && <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs tabular-nums">{speed}%</span>}
        {onAutoScrollChange && (
          <button
            type="button"
            aria-pressed={autoScroll}
            aria-label="Rolagem"
            onClick={() => onAutoScrollChange(!autoScroll)}
            className={`hidden size-10 shrink-0 items-center justify-center rounded-lg sm:inline-flex ${autoScroll ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
          >
            <ScrollText className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={drawerId}
          aria-label={open ? 'Fechar controles' : 'Abrir controles'}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted"
        >
          {open ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
        </button>
      </div>}
    </div>
    </>
  );
};
