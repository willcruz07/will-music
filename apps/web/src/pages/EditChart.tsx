import { ArrowLeft, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChartView } from '../components/ChartView.tsx';
import { ChordPicker } from '../components/ChordPicker.tsx';
import { setChordAt } from '../lib/chordProEdit.ts';
import { restoreGeneratedChart, saveEditedChart } from '../lib/chartEdit.ts';
import { type Song, db } from '../lib/db.ts';
import { createHistory } from '../lib/history.ts';
import { Button, IconButton } from '../ui/Button.tsx';

export const EditChart = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const history = useRef(createHistory(''));
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [tab, setTab] = useState<'texto' | 'ver'>('texto');
  const [picking, setPicking] = useState<{ line: number; char: number } | null>(null);
  const [, force] = useState(0);
  const dirty = text !== saved;

  useEffect(() => {
    void (async () => {
      const [s, chart, analysis] = await Promise.all([
        db.songs.get(id),
        db.charts.where('songId').equals(id).first(),
        db.analyses.where('songId').equals(id).first(),
      ]);
      setSong(s ?? null);
      setHasAnalysis(!!analysis);
      history.current = createHistory(chart?.chordPro ?? '');
      setText(chart?.chordPro ?? '');
      setSaved(chart?.chordPro ?? '');
    })();
  }, [id]);

  const update = (next: string) => {
    history.current.set(next);
    setText(next);
  };
  const undo = () => {
    history.current.undo();
    setText(history.current.value);
    force((n) => n + 1);
  };
  const redo = () => {
    history.current.redo();
    setText(history.current.value);
    force((n) => n + 1);
  };

  const save = useCallback(async () => {
    await saveEditedChart(id, text);
    setSaved(text);
    navigate(`/musica/${id}`, { replace: true });
  }, [id, text, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        void save();
      } else if (k === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (k === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const leave = () => {
    if (!dirty || confirm('Sair sem salvar as alterações?')) navigate(`/musica/${id}`);
  };

  if (!song) return null;

  const editor = (
    <textarea
      aria-label="Cifra em ChordPro"
      value={text}
      onChange={(e) => update(e.target.value)}
      spellCheck={false}
      className="h-[60dvh] w-full resize-y rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-relaxed outline-none focus:border-primary"
    />
  );
  const usedChords = [...new Set([...text.matchAll(/\[([^\]]+)\]/gu)].map((m) => m[1]!))].slice(0, 12);
  const preview = (
    <div>
      <div className="h-[60dvh] overflow-auto rounded-lg border border-border p-4">
        <p className="mb-3 text-sm text-muted-foreground">Toque numa palavra para pôr, trocar ou tirar o acorde.</p>
        <ChartView chordPro={text} transpose={0} preferFlats={false} fontSize={16} onPick={(line, char) => setPicking({ line, char })} />
      </div>
      {picking && (
        <ChordPicker
          suggestions={usedChords}
          onCancel={() => setPicking(null)}
          onApply={(chord) => {
            update(setChordAt(text, picking.line, picking.char, chord));
            setPicking(null);
          }}
        />
      )}
    </div>
  );

  return (
    <section>
      <Link to={`/musica/${id}`} className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {song.title}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold tracking-tight">Editar cifra</h1>
        <IconButton label="Desfazer" onClick={undo} disabled={!history.current.canUndo}>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton label="Refazer" onClick={redo} disabled={!history.current.canRedo}>
          <Redo2 className="size-4" />
        </IconButton>
        {hasAnalysis && (
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm('Descartar suas edições e voltar à cifra gerada pela análise?')) {
                void restoreGeneratedChart(id).then(() => {
                  setSaved(text);
                  navigate(`/musica/${id}`, { replace: true });
                });
              }
            }}
          >
            Restaurar cifra gerada
          </Button>
        )}
        <Button variant="outline" onClick={leave}>
          Cancelar
        </Button>
        <Button onClick={() => void save()} disabled={!dirty}>
          Salvar
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Escreva o acorde entre colchetes antes da sílaba: <code className="rounded bg-muted px-1">[G]Ninguém explica [D]Deus</code>. Seções: <code className="rounded bg-muted px-1">{'{comment: Refrão}'}</code>.
      </p>

      <div className="mt-4 flex gap-2 md:hidden" role="tablist">
        {(['texto', 'ver'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm ${tab === t ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>
            {t === 'texto' ? 'Texto' : 'Ver'}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className={tab === 'texto' ? '' : 'hidden md:block'}>{editor}</div>
        <div className={tab === 'ver' ? '' : 'hidden md:block'}>{preview}</div>
      </div>
    </section>
  );
};
