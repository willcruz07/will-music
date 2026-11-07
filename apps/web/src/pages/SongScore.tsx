import { ArrowLeft, Download, Music4, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Player, type PlayerControls } from '../components/Player.tsx';
import { ScoreView } from '../components/ScoreView.tsx';
import { type Analysis, type ScoreRecord, type Song, db } from '../lib/db.ts';
import {
  type ScoreProgress,
  type ScoreType,
  SCORE_TYPES,
  buildScoreXml,
  downloadText,
  hasScoreType,
  saveScore,
  transcribeDrums,
  transcribeKeys,
  transcribeMelody,
} from '../lib/score.ts';
import { createScoreSynth, toSynthEvents } from '../lib/synth.ts';
import { useStems } from '../lib/useStems.ts';
import { Button } from '../ui/Button.tsx';

const progressLabel = (p: ScoreProgress) =>
  p.stage === 'decode' ? 'Preparando o áudio' : p.stage === 'models' ? 'Baixando o modelo de notas' : `Escutando as notas (${p.done} de ${p.total})`;

const TYPE_KEY = 'wm-score-type';
const readType = (): ScoreType => {
  try {
    const v = localStorage.getItem(TYPE_KEY);
    return SCORE_TYPES.some((t) => t.type === v) ? (v as ScoreType) : 'guitar';
  } catch {
    return 'guitar';
  }
};

const EMPTY_TEXT: Record<ScoreType, string> = {
  melody: 'O app escuta a voz principal (ou a música inteira, se as faixas não foram separadas) e escreve a melodia com a cifra por cima.',
  guitar: 'O app escuta a voz principal e escreve a melodia em pauta e em tablatura, com a corda e a casa de cada nota.',
  keys: 'O app escuta o piano (ou o acompanhamento) e escreve as duas mãos: clave de sol para a direita e clave de fá para a esquerda, na armadura do tom.',
  drums: 'O app escuta a faixa de bateria e escreve bumbo, caixa e chimbal. Antes, separe as faixas em 4, 6 ou na completa pelos controles do player.',
};

/** Keyed by the song id, so a transcription still running for the previous song can never land on this one. */
export const SongScore = () => {
  const { id = '' } = useParams();
  return <SongScorePage key={id} id={id} />;
};

const SongScorePage = ({ id }: { id: string }) => {
  const [song, setSong] = useState<Song | null | undefined>(undefined);
  const [analysis, setAnalysis] = useState<Analysis | undefined>();
  const [score, setScore] = useState<ScoreRecord | undefined>();
  const [audioUrl, setAudioUrl] = useState<string>();
  const [type, setType] = useState<ScoreType>(readType);
  const [progress, setProgress] = useState<ScoreProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synthOn, setSynthOn] = useState(false);
  const [onlyScore, setOnlyScore] = useState(false);
  const [synthVolume, setSynthVolume] = useState(0.7);
  const synth = useRef<ReturnType<typeof createScoreSynth> | null>(null);
  const player = useRef<PlayerControls | null>(null);
  const stems = useStems(id, audioUrl);

  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    void (async () => {
      const [s, a, sc, audio] = await Promise.all([db.songs.get(id), db.analyses.where('songId').equals(id).first(), db.scores.get(id), db.audio.get(id)]);
      if (cancelled) return;
      setAnalysis(a);
      setScore(sc);
      if (audio) {
        url = URL.createObjectURL(audio.blob);
        setAudioUrl(url);
      }
      setSong(s ?? null);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      synth.current?.dispose();
    };
  }, [id]);

  const xml = useMemo(() => (song ? buildScoreXml(type, song, analysis, score) : null), [type, song, analysis, score]);

  // What the score synth plays: the notes of the part on screen, at their real times in the song.
  useEffect(() => {
    const events =
      type === 'keys' ? toSynthEvents({ notes: score?.piano?.notes }) : type === 'drums' ? toSynthEvents({ hits: score?.drums?.hits }) : toSynthEvents({ notes: score?.notes });
    synth.current?.setEvents(events);
  }, [type, score]);
  useEffect(() => synth.current?.setVolume(synthVolume), [synthVolume]);
  useEffect(() => {
    if (!synthOn) synth.current?.stop();
  }, [synthOn]);

  if (song === undefined) return null;
  if (song === null) return <p className="mt-8">Música não encontrada.</p>;

  const chooseType = (next: ScoreType) => {
    setType(next);
    setError(null);
    try {
      localStorage.setItem(TYPE_KEY, next);
    } catch {
      /* per-viewer convenience only */
    }
  };

  const generate = () => {
    setError(null);
    setProgress({ stage: 'decode', done: 0, total: 1 });
    const run = type === 'keys' ? transcribeKeys : type === 'drums' ? transcribeDrums : transcribeMelody;
    void run(song, setProgress)
      .then(setScore)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'A transcrição das notas falhou.'))
      .finally(() => setProgress(null));
  };

  const setBpm = (input: HTMLInputElement) => {
    const bpm = Number(input.value);
    if (!score) return;
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) {
      input.value = String(score.bpm); // out of range: show the tempo actually used
      return;
    }
    if (Math.round(bpm) === score.bpm) return;
    const next = { ...score, bpm: Math.round(bpm) };
    setScore(next);
    void saveScore(next);
  };

  const partEvents = () =>
    type === 'keys' ? toSynthEvents({ notes: score?.piano?.notes }) : type === 'drums' ? toSynthEvents({ hits: score?.drums?.hits }) : toSynthEvents({ notes: score?.notes });

  // Runs inside the tap: the audio context is created and resumed here (iOS only allows that in a gesture),
  // and if the music is already playing the notes start right away.
  const toggleSynth = (on: boolean) => {
    setSynthOn(on);
    if (!on) return;
    synth.current ??= createScoreSynth();
    synth.current.unlock();
    synth.current.setVolume(synthVolume);
    synth.current.setEvents(partEvents());
    if (player.current?.playing()) synth.current.play(player.current.currentTime(), player.current.rate());
  };

  const ready = hasScoreType(score, type);
  const info = SCORE_TYPES.find((t) => t.type === type)!;
  const sources = onlyScore && synthOn ? stems.sources?.map((s) => ({ ...s, volume: 0 })) : stems.sources;

  const synthSection = (
    <section className="border-t border-border px-4 py-3">
      <h2 className="mb-2 text-xs font-semibold text-muted-foreground">Som da partitura</h2>
      {ready ? (
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={synthOn} onChange={(e) => toggleSynth(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Tocar as notas da partitura junto com a música
          </label>
          {synthOn && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyScore} onChange={(e) => setOnlyScore(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                Ouvir só a partitura (silencia a música)
              </label>
              <label className="flex items-center gap-3">
                <span>Volume das notas</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(synthVolume * 100)}
                  aria-label="Volume das notas"
                  onChange={(e) => setSynthVolume(Number(e.target.value) / 100)}
                  className="flex-1 accent-[var(--primary)]"
                />
              </label>
            </>
          )}
          <p className="text-xs text-muted-foreground">As notas tocam no tempo em que foram ouvidas, acompanhando a velocidade e o loop.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Gere a partitura de {info.label.toLowerCase()} para ouvir as notas dela.</p>
      )}
    </section>
  );

  return (
    <section>
      <Link to={`/musica/${song.id}`} className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {song.title}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Partitura</h1>

      <div className="-mx-4 mt-4 overflow-x-auto px-4">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="radiogroup" aria-label="Tipo de partitura">
          {SCORE_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={type === t.type}
              onClick={() => chooseType(t.type)}
              className={`min-h-10 whitespace-nowrap rounded-lg px-4 text-sm transition-colors ${type === t.type ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
              {hasScoreType(score, t.type) && type !== t.type && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" aria-label="pronta" />}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{info.hint}</p>

      {!ready && (
        <div className="mt-4 max-w-2xl rounded-xl border border-border bg-surface p-5">
          <Music4 className="size-8 text-primary" />
          {audioUrl ? (
            <>
              <p className="mt-3 font-semibold">Escrever a partitura de {info.label.toLowerCase()}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {EMPTY_TEXT[type]} {type !== 'drums' && 'Separar as faixas antes deixa o resultado mais limpo. Na primeira vez baixa um modelo pequeno (230 KB).'}
              </p>
              <Button className="mt-4" onClick={generate} disabled={!!progress}>
                <Music4 className="size-4" /> {progress ? 'Gerando…' : 'Gerar partitura'}
              </Button>
            </>
          ) : (
            <p className="mt-3 text-muted-foreground">A partitura precisa do áudio da música. Esta música foi criada sem áudio.</p>
          )}
        </div>
      )}

      {ready && score && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm">
            Andamento (BPM)
            <input
              type="number"
              min={40}
              max={240}
              defaultValue={score.bpm}
              key={score.bpm}
              aria-label="Andamento (BPM)"
              className="w-16 bg-transparent text-right font-semibold tabular-nums outline-none"
              onBlur={(e) => setBpm(e.currentTarget)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
          <Button variant="outline" onClick={() => xml && downloadText(xml, `${song.title || 'partitura'} (${info.label.toLowerCase()}).musicxml`, 'application/vnd.recordare.musicxml+xml')}>
            <Download className="size-4" /> Baixar MusicXML
          </Button>
          <Button variant="ghost" onClick={generate} disabled={!!progress || !audioUrl}>
            <RefreshCw className="size-4" /> Gerar de novo
          </Button>
        </div>
      )}

      {progress && (
        <p className="mt-3 text-sm" role="status">
          {progressLabel(progress)}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {ready && xml && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">É um rascunho feito de ouvido pelo app: confira tocando e ajuste no MuseScore se precisar.</p>
          <ScoreView xml={xml} />
        </>
      )}

      {sources && (
        <>
          <Player
            sources={sources}
            onTime={() => {}}
            title={song.title}
            songId={song.id}
            stems={stems}
            extra={synthSection}
            controls={player}
            onTransport={(t) => {
              if (!synthOn) return;
              synth.current ??= createScoreSynth();
              synth.current.setVolume(synthVolume);
              synth.current.setEvents(partEvents());
              if (t.playing) synth.current.play(t.time, t.rate);
              else synth.current.stop();
            }}
          />
          <div className="h-32 md:h-24" aria-hidden />
        </>
      )}
    </section>
  );
};
