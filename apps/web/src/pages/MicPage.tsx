import { detectPitch, midiName, voiceType } from '@will-music/engine';
import { Mic, MicOff, RotateCcw } from 'lucide-react';
import { ScrollStrip } from '../components/ScrollStrip.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChordDiagram } from '../components/ChordDiagram.tsx';
import { readInstrument } from '../components/ChordPanel.tsx';
import { openMic, tapSamples } from '../lib/mic.ts';
import { TUNINGS, type TunerReading, decimate2, median, tunerReading } from '../lib/tuner.ts';
import type { LiveChordsRequest, LiveChordsResponse } from '../worker/liveChords.worker.ts';
import { Button } from '../ui/Button.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { SheetSelect } from '../ui/SheetSelect.tsx';
import { PlayButton, useStudySynth } from '../study/widgets.tsx';

type Tab = 'tuner' | 'voice' | 'chords';
const TABS: { id: Tab; label: string }[] = [
  { id: 'tuner', label: 'Afinador' },
  { id: 'voice', label: 'Voz' },
  { id: 'chords', label: 'Acordes' },
];

const TRACE_SEC = 10;

/** Needle from −50 to +50 cents on a half circle; green inside ±5. */
const Gauge = ({ cents, inTune, active }: { cents: number; inTune: boolean; active: boolean }) => {
  const angle = (Math.max(-50, Math.min(50, cents)) / 50) * 80;
  return (
    <svg viewBox="0 0 220 124" className="w-full max-w-sm" aria-hidden>
      {Array.from({ length: 21 }, (_, i) => {
        const a = ((i - 10) / 10) * 80 * (Math.PI / 180);
        const long = i % 5 === 0;
        const r1 = long ? 86 : 92;
        return <line key={i} x1={110 + Math.sin(a) * r1} y1={112 - Math.cos(a) * r1} x2={110 + Math.sin(a) * 100} y2={112 - Math.cos(a) * 100} stroke="currentColor" strokeOpacity={i === 10 ? 0.9 : 0.35} strokeWidth={long ? 2 : 1} />;
      })}
      <path d="M 101.2 13.4 A 100 100 0 0 1 118.8 13.4" stroke="var(--primary)" strokeWidth="6" fill="none" strokeLinecap="round" opacity={0.8} />
      <g style={{ transform: `rotate(${active ? angle : 0}deg)`, transformOrigin: '110px 112px', transition: 'transform 120ms linear' }}>
        <line x1="110" y1="112" x2="110" y2="22" stroke={!active ? 'var(--muted-foreground)' : inTune ? 'var(--primary)' : '#f59e0b'} strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="110" cy="112" r="6" fill="currentColor" />
    </svg>
  );
};

/** The sung pitch over the last seconds, on a staff of semitone lines. */
const Trace = ({ points, now }: { points: { t: number; midi: number }[]; now: number }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext?.('2d');
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); }
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const recent = points.filter((p) => now - p.t < TRACE_SEC);
    const mids = recent.map((p) => p.midi);
    // Fit everything sung in the window (at least an octave and a half), with a little room above and below.
    const minM = mids.length ? Math.min(...mids) : 54;
    const maxM = mids.length ? Math.max(...mids) : 66;
    const span = Math.max(18, maxM - minM + 4);
    const lo = Math.floor((minM + maxM) / 2 - span / 2);
    const hi = lo + span;
    const y = (m: number) => h - ((m - lo) / (hi - lo)) * h;
    const style = getComputedStyle(document.documentElement);
    ctx.font = '11px system-ui';
    for (let m = lo; m <= hi; m++) {
      const natural = ![1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
      ctx.strokeStyle = style.getPropertyValue('--border').trim() || '#1f2c44';
      ctx.globalAlpha = natural ? 1 : 0.4;
      ctx.beginPath();
      ctx.moveTo(34, y(m));
      ctx.lineTo(w, y(m));
      ctx.stroke();
      if (natural) {
        ctx.fillStyle = style.getPropertyValue('--muted-foreground').trim() || '#93a3bc';
        ctx.fillText(midiName(m), 2, y(m) + 4);
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = style.getPropertyValue('--glow').trim() || '#22d3ee';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let open = false;
    let last = -1;
    for (const p of recent) {
      const x = 34 + ((p.t - (now - TRACE_SEC)) / TRACE_SEC) * (w - 34);
      if (!open || p.t - last > 0.15) ctx.moveTo(x, y(p.midi));
      else ctx.lineTo(x, y(p.midi));
      open = true;
      last = p.t;
    }
    ctx.stroke();
  }, [points, now]);
  return <canvas ref={canvas} className="h-64 w-full rounded-xl bg-surface-2" aria-label="Desenho da altura cantada nos últimos segundos" />;
};

/**
 * The microphone at work: a tuner for instruments, the pitch of a voice with a voice-type suggestion,
 * and the chord being played around (with the same chord model used for songs).
 */
export const MicPage = () => {
  const [tab, setTab] = useState<Tab>('tuner');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState('guitar');
  const [a4, setA4] = useState(440);
  const [selectedString, setSelectedString] = useState<number | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [target, setTarget] = useState(60);
  const [voicePitch, setVoicePitch] = useState<number | null>(null);
  const synth = useStudySynth();
  const [reading, setReading] = useState<(TunerReading & { hz: number }) | null>(null);
  const [voiceNow, setVoiceNow] = useState<string | null>(null);
  const [frameTick, setFrame] = useState(0);
  const [chord, setChord] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [chordStatus, setChordStatus] = useState<string | null>(null);
  const mic = useRef<Awaited<ReturnType<typeof openMic>> | null>(null);
  const trace = useRef<{ t: number; midi: number }[]>([]);
  const sung = useRef<number[]>([]);
  const settings = useRef({ presetId, a4, selectedString });
  settings.current = { presetId, a4, selectedString };
  const generation = useRef(0);
  const referenceUntil = useRef(0);

  const mounted = useRef(true);
  const opening = useRef(false);
  const [starting, setStarting] = useState(false);

  const stop = () => {
    generation.current++;
    const active = mic.current;
    mic.current = null;
    active?.close();
    synth.stop();
    if (mounted.current) {
      setRunning(false);
      setStarting(false);
      setReading(null);
      setVoiceNow(null);
      setVoicePitch(null);
      setChord(null);
      setChordStatus(null);
    }
  };

  const start = async () => {
    if (opening.current || mic.current) return; // one microphone at a time, even with a double tap
    opening.current = true;
    const request = ++generation.current;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const opened = await openMic();
      // Left the page while the permission prompt was open: release the microphone right away.
      if (!mounted.current || request !== generation.current || document.hidden) return opened.close();
      mic.current = opened;
      trace.current = [];
      sung.current = [];
      setHistory([]);
      setFrame(f => f + 1);
      setRunning(true);
    } catch (e) {
      if (mounted.current && request === generation.current) setError(e instanceof Error ? e.message : 'Não foi possível usar o microfone.');
    } finally {
      opening.current = false;
      if (mounted.current && request === generation.current) setStarting(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);

  useEffect(() => {
    const hide = () => {
      if (document.hidden && (mic.current || opening.current)) {
        stop();
        setNotice('Microfone pausado ao sair da tela. Toque em Ligar microfone para continuar.');
      }
    };
    const leave = () => { stop(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); };
  }, []);

  useEffect(() => {
    const active = mic.current;
    if (!running || !active) return;
    const interrupted = () => {
      if (mic.current !== active) return;
      stop();
      setNotice('A captura foi interrompida pelo aparelho. Toque em Ligar microfone para retomar.');
    };
    const state = () => { if (active.context.state !== 'running') interrupted(); };
    const tracks = active.stream.getAudioTracks();
    tracks.forEach(track => { track.addEventListener('ended', interrupted); track.addEventListener('mute', interrupted); });
    active.context.addEventListener('statechange', state);
    state();
    return () => { tracks.forEach(track => { track.removeEventListener('ended', interrupted); track.removeEventListener('mute', interrupted); }); active.context.removeEventListener('statechange', state); };
  }, [running]);

  // Pitch loop (tuner and voice): ~25 readings per second, steadied by a short median.
  useEffect(() => {
    const m = mic.current;
    if (!running || !m || tab === 'chords') return;
    const analyser = m.context.createAnalyser();
    analyser.fftSize = 4096;
    m.source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    // At 44.1/48 kHz, analyse at half the rate (a quarter of the work, same accuracy).
    const halve = m.context.sampleRate >= 44100;
    const half = new Float32Array(analyser.fftSize / 2);
    const rate = halve ? m.context.sampleRate / 2 : m.context.sampleRate;
    const recent: number[] = [];
    let lastFrame = -Infinity;
    let lastValid = 0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const timestamp = performance.now();
      if (timestamp - lastFrame < 50 || document.hidden) return;
      lastFrame = timestamp;
      analyser.getFloatTimeDomainData(buf);
      const preset = TUNINGS.find((t) => t.id === settings.current.presetId)!;
      const p = timestamp < referenceUntil.current ? null : detectPitch(halve ? decimate2(buf, half) : buf, rate, { minHz: tab === 'voice' ? 55 : preset.minHz, maxHz: tab === 'voice' ? 1200 : 1600 });
      const now = performance.now() / 1000;
      if (!p || p.clarity < 0.85) {
        recent.length = 0;
        if (timestamp - lastValid > 600) { setReading(null); setVoiceNow(null); setVoicePitch(null); }
        if (tab === 'voice') setFrame((f) => f + 1);
        return;
      }
      lastValid = timestamp;
      recent.push(p.hz);
      if (recent.length > 5) recent.shift();
      const hz = median(recent);
      if (tab === 'tuner') setReading({ ...tunerReading(hz, preset, settings.current.a4, settings.current.selectedString), hz });
      else {
        const midi = 69 + 12 * Math.log2(hz / settings.current.a4);
        trace.current.push({ t: now, midi });
        trace.current = trace.current.filter((x) => now - x.t < TRACE_SEC);
        sung.current.push(midi);
        if (sung.current.length > 3000) sung.current.shift();
        setVoiceNow(midiName(Math.round(midi)));
        setVoicePitch(midi);
        setFrame((f) => f + 1);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      m.source.disconnect(analyser);
    };
  }, [running, tab, presetId, selectedString, a4]);

  // Live chords: the microphone feeds the chord model in a worker, once per second.
  useEffect(() => {
    const m = mic.current;
    if (!running || !m || tab !== 'chords') return;
    let cancelled = false;
    setChordStatus('Preparando o modelo de acordes…');
    const worker = new Worker(new URL('../worker/liveChords.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<LiveChordsResponse>) => {
      if (cancelled) return;
      const msg = e.data;
      if (msg.type === 'ready') setChordStatus('Escutando… toque um acorde perto do aparelho.');
      else if (msg.type === 'error') { setChord(null); setChordStatus(`Não foi possível reconhecer: ${msg.message}`); }
      else {
        setChord(msg.label);
        if (msg.label) setHistory((h) => (h[h.length - 1] === msg.label ? h : [...h, msg.label!].slice(-12)));
      }
    };
    worker.onerror = () => { if (!cancelled) { setChord(null); setChordStatus('O reconhecimento foi interrompido. Troque de aba ou religue o microfone para tentar novamente.'); } };
    worker.postMessage({ type: 'start', sampleRate: m.context.sampleRate } satisfies LiveChordsRequest);
    let untap: (() => void) | null = null;
    void tapSamples(m.context, m.source, (samples) => worker.postMessage({ type: 'audio', samples } satisfies LiveChordsRequest, [samples.buffer]))
      .then((u) => {
        if (cancelled) u();
        else untap = u;
      })
      .catch(() => { if (!cancelled) { worker.terminate(); setChordStatus('Não foi possível iniciar a captura contínua neste navegador. Religue o microfone e confira a permissão de áudio.'); } });
    return () => {
      cancelled = true;
      worker.onmessage = null;
      worker.onerror = null;
      untap?.();
      worker.postMessage({ type: 'stop' } satisfies LiveChordsRequest);
      worker.terminate();
    };
  }, [running, tab]);

  const preset = TUNINGS.find((t) => t.id === presetId)!;
  const suggestion = useMemo(() => voiceType(sung.current), [frameTick]);
  const now = performance.now() / 1000;
  const deviation = voicePitch === null ? null : Math.round((voicePitch - target) * 100);
  const hearReference = (interval: boolean) => {
    const notes = interval ? [target, target + 2, target] : [target];
    const duration = notes.length * 0.8;
    referenceUntil.current = performance.now() + (duration + 0.5) * 1000;
    setVoiceNow(null); setVoicePitch(null);
    synth.play(interval ? 'mic-interval' : 'mic-target', notes.map((pitch, i) => ({ time: i * 0.8, dur: 0.65, pitch: pitch + 12 * Math.log2(a4 / 440) })));
  };

  return (
    <section className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Microfone</h1>
        {running ? (
          <Button variant="outline" onClick={stop}>
            <MicOff className="size-4" /> Desligar
          </Button>
        ) : (
          <Button onClick={() => void start()} disabled={starting}>
            <Mic className="size-4" /> {starting ? 'Ligando…' : 'Ligar microfone'}
          </Button>
        )}
      </div>
      <p className="mt-2 text-muted-foreground">Afine o instrumento, veja a nota que está sendo cantada e descubra o acorde que está tocando perto de você. Nada sai do aparelho.</p>
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status" className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm text-muted-foreground">{notice}</p>}

      <ScrollStrip className="mt-4" role="tablist" label="Ferramenta" selected={tab} onKeyDown={rovingKeys} innerClassName="rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => { synth.stop(); setReading(null); setVoiceNow(null); setVoicePitch(null); setChord(null); setTab(t.id); }}
            className={`min-h-10 rounded-lg px-4 text-sm ${tab === t.id ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </ScrollStrip>

      {tab === 'tuner' && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
              <span aria-hidden>Instrumento</span>
              <SheetSelect label="Instrumento" value={presetId} onChange={id => { setSelectedString(undefined); setReading(null); setPresetId(id); }} className="flex-1 font-semibold sm:flex-none" options={TUNINGS.map((t) => ({ value: t.id, label: t.label }))} />
            </span>
            <label className="flex items-center gap-2">
              Lá de referência
              <input
                type="number"
                min={415}
                max={466}
                value={a4}
                aria-label="Lá de referência (Hz)"
                onChange={(e) => { setReading(null); setA4(Math.min(466, Math.max(415, Number(e.target.value) || 440))); }}
                className="h-10 w-20 rounded-lg border border-border bg-surface px-2 tabular-nums"
              />
              Hz
            </label>
          </div>
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-surface px-4 py-6 text-center">
            <Gauge cents={reading?.cents ?? 0} inTune={!!reading?.inTune} active={!!reading} />
            <p className={`-mt-2 font-[family-name:var(--font-display)] text-7xl font-semibold tracking-tight ${reading?.inTune ? 'text-chord' : ''}`}>
              {reading ? reading.note : '–'}
              {reading && <span className="text-3xl text-muted-foreground">{reading.octave}</span>}
            </p>
            <p className="mt-1 text-lg text-muted-foreground">{reading ? `${reading.solfege} · ${reading.hz.toFixed(1)} Hz` : running ? 'Aguardando som… toque uma corda' : 'Ligue o microfone'}</p>
            <p className={`mt-3 min-h-7 text-lg font-semibold ${reading?.inTune ? 'text-chord' : 'text-amber-500'}`} role="status">
              {reading && (reading.inTune ? 'Afinado' : Math.abs(reading.cents) > 150 ? `Nota distante do alvo (${reading.cents > 0 ? '+' : ''}${reading.cents} cents). Confira a corda e possíveis harmônicos.` : reading.cents < 0 ? `Afine para cima (${reading.cents} cents)` : `Afine para baixo (+${reading.cents} cents)`)}
            </p>
            {preset.strings.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Cordas">
                <button type="button" aria-pressed={selectedString === undefined} onClick={() => { setSelectedString(undefined); setReading(null); }} className={`min-h-11 rounded-full border px-3 text-sm ${selectedString === undefined ? 'border-primary text-chord' : 'border-border text-muted-foreground'}`}>Automático</button>
                {preset.strings.map((m, i) => {
                  const string = preset.strings.length - i;
                  const active = reading?.target?.string === string;
                  return (
                    <button key={i} type="button" aria-pressed={selectedString === string} onClick={() => { setSelectedString(string); setReading(null); }} className={`min-h-11 rounded-full border px-3 py-1 text-sm tabular-nums ${selectedString === string ? 'border-primary bg-primary/15 text-chord' : active ? (reading?.inTune ? 'border-primary text-chord' : 'border-amber-500 text-amber-500') : 'border-border text-muted-foreground'}`}>
                      {string}ª · {midiName(m)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Toque uma corda por vez. Se a escolha automática oscilar, selecione a corda desejada. Um harmônico pode aparecer uma oitava acima: confira também o som e a corda selecionada.</p>
        </div>
      )}

      {tab === 'voice' && (
        <div className="mt-6 space-y-3">
          <section className="rounded-2xl border border-primary/30 bg-surface p-4" aria-label="Prática de afinação vocal">
            <h2 className="font-semibold">Ouça, espere e cante</h2>
            <p className="mt-1 text-sm text-muted-foreground">Escolha uma referência confortável. Sustente a nota ou repita a frase de três notas depois de ouvir.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <SheetSelect label="Nota-alvo" value={String(target)} onChange={value => { synth.stop(); setTarget(Number(value)); }} options={Array.from({ length: 37 }, (_, i) => ({ value: String(48 + i), label: midiName(48 + i) }))} />
              <PlayButton label={`Referência ${midiName(target)}`} active={synth.playing === 'mic-target'} onClick={() => hearReference(false)} />
              <PlayButton label="Frase: nota, segunda maior, nota" active={synth.playing === 'mic-interval'} onClick={() => hearReference(true)} />
            </div>
            <p className={`mt-3 text-sm font-semibold ${deviation !== null && Math.abs(deviation) <= 15 ? 'text-chord' : 'text-muted-foreground'}`}>{deviation === null ? `Alvo: ${midiName(target)} · aguardando sua voz` : Math.abs(deviation) <= 15 ? `Próximo ao alvo ${midiName(target)} · ${deviation > 0 ? '+' : ''}${deviation} cents` : `${Math.abs(deviation)} cents ${deviation < 0 ? 'abaixo' : 'acima'} de ${midiName(target)}`}</p>
            <p className="mt-2 text-xs text-muted-foreground">A captura de notas é ignorada durante a referência sonora e por um breve intervalo depois, para não contar o som do aparelho como sua voz. A comparação usa o alvo escolhido, inclusive sua oitava.</p>
          </section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Nota agora</p>
              <p className="font-[family-name:var(--font-display)] text-5xl font-semibold" role="status">
                {voiceNow ?? '–'}
              </p>
            </div>
            <div className="text-right text-sm">
              {suggestion ? (
                <>
                  <p>
                    Faixa observada nesta sessão: <span className="font-semibold tabular-nums">{midiName(suggestion.low)} a {midiName(suggestion.high)}</span>
                  </p>
                  <details className="mt-2 max-w-64 text-xs text-muted-foreground"><summary className="cursor-pointer">Referência aproximada de registro</summary><p className="mt-2">{suggestion.label}: comparação baseada somente nas alturas captadas. Não determina sua classificação vocal ou tessitura.</p></details>
                </>
              ) : (
                <p className="max-w-56 text-muted-foreground">Cante algumas notas confortáveis para observar a faixa captada, sem procurar seus limites.</p>
              )}
            </div>
          </div>
          <Trace points={trace.current} now={now} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Faixa estimada pelas notas mais frequentes da amostra; não representa sua extensão vocal completa.</p>
            <Button
              variant="ghost"
              onClick={() => {
                sung.current = [];
                trace.current = [];
                setVoiceNow(null);
                setVoicePitch(null);
                setFrame((f) => f + 1);
              }}
            >
              <RotateCcw className="size-4" /> Zerar
            </Button>
          </div>
        </div>
      )}

      {tab === 'chords' && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground" role="status">
            {running ? chordStatus : 'Ligue o microfone e toque perto do aparelho. Na primeira vez baixa o modelo de acordes (17 MB).'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-surface p-6">
            <p className="min-w-32 font-[family-name:var(--font-display)] text-7xl font-semibold text-chord" aria-label="Acorde agora">
              {chord ?? '–'}
            </p>
            {chord && <ChordDiagram chord={chord} instrument={readInstrument()} />}
          </div>
          {history.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Acordes ouvidos">
              {history.map((c, i) => (
                <span key={`${c}-${i}`} className="rounded-full border border-border px-3 py-1 text-sm">
                  {c}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">O reconhecimento usa uma janela dos últimos segundos; o atraso depende do aparelho. Toque um acorde sustentado: uma nota cantada isoladamente não determina um acorde completo.</p>
        </div>
      )}
    </section>
  );
};
