import { ArrowLeft, Download, Guitar, Music4, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ScoreView } from '../components/ScoreView.tsx';
import { type Analysis, type ScoreRecord, type Song, db } from '../lib/db.ts';
import { type ScoreProgress, buildSongScore, downloadText, saveScore, transcribeMelody } from '../lib/score.ts';
import { Button } from '../ui/Button.tsx';

const progressLabel = (p: ScoreProgress) =>
  p.stage === 'decode' ? 'Preparando o áudio' : p.stage === 'models' ? 'Baixando o modelo de notas' : `Escutando as notas (${p.done} de ${p.total})`;

const TAB_KEY = 'wm-score-tab';
const readTab = () => {
  try {
    return localStorage.getItem(TAB_KEY) !== '0';
  } catch {
    return true;
  }
};

export const SongScore = () => {
  const { id = '' } = useParams();
  const [song, setSong] = useState<Song | null | undefined>(undefined);
  const [analysis, setAnalysis] = useState<Analysis | undefined>();
  const [score, setScore] = useState<ScoreRecord | undefined>();
  const [hasAudio, setHasAudio] = useState(false);
  const [tab, setTab] = useState(readTab);
  const [progress, setProgress] = useState<ScoreProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, a, sc, audio] = await Promise.all([db.songs.get(id), db.analyses.where('songId').equals(id).first(), db.scores.get(id), db.audio.get(id)]);
      setAnalysis(a);
      setScore(sc);
      setHasAudio(!!audio);
      setSong(s ?? null);
    })();
  }, [id]);

  const xml = useMemo(() => (song && score ? buildSongScore(song, analysis, score, { tab }) : ''), [song, analysis, score, tab]);

  if (song === undefined) return null;
  if (song === null) return <p className="mt-8">Música não encontrada.</p>;

  const generate = () => {
    setError(null);
    setProgress({ stage: 'decode', done: 0, total: 1 });
    void transcribeMelody(song, setProgress)
      .then(setScore)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'A transcrição das notas falhou.'))
      .finally(() => setProgress(null));
  };

  const toggleTab = () => {
    setTab((v) => {
      try {
        localStorage.setItem(TAB_KEY, v ? '0' : '1');
      } catch {
        /* per-viewer convenience only */
      }
      return !v;
    });
  };

  const setBpm = (bpm: number) => {
    if (!score || !Number.isFinite(bpm) || bpm < 40 || bpm > 240) return;
    const next = { ...score, bpm: Math.round(bpm) };
    setScore(next);
    void saveScore(next);
  };

  return (
    <section>
      <Link to={`/musica/${song.id}`} className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {song.title}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Partitura</h1>

      {!score && (
        <div className="mt-6 max-w-2xl rounded-xl border border-border bg-surface p-5">
          <Music4 className="size-8 text-primary" />
          {hasAudio ? (
            <>
              <p className="mt-3 font-semibold">Escrever a melodia desta música</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O app escuta a voz principal (ou a música inteira, se as faixas não foram separadas) e escreve as notas em partitura e tablatura. Separar as faixas
                antes deixa o resultado bem mais limpo. Na primeira vez baixa um modelo pequeno (230 KB).
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

      {score && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant={tab ? 'primary' : 'outline'} aria-pressed={tab} onClick={toggleTab}>
            <Guitar className="size-4" /> Tablatura
          </Button>
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
              onBlur={(e) => setBpm(Number(e.currentTarget.value))}
              onKeyDown={(e) => e.key === 'Enter' && setBpm(Number(e.currentTarget.value))}
            />
          </label>
          <Button variant="outline" onClick={() => downloadText(xml, `${song.title || 'partitura'}.musicxml`, 'application/vnd.recordare.musicxml+xml')}>
            <Download className="size-4" /> Baixar MusicXML
          </Button>
          <Button variant="ghost" onClick={generate} disabled={!!progress || !hasAudio}>
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
      {score && (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Transcrita {score.source === 'lead' ? 'da voz separada' : 'da música inteira'}. É um rascunho: confira de ouvido e ajuste no MuseScore se precisar.
          </p>
          <ScoreView xml={xml} />
        </>
      )}
    </section>
  );
};
