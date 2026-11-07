import { ArrowLeft, Music2, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChartView } from '../components/ChartView.tsx';
import { ChordLibrary } from '../components/ChordLibrary.tsx';
import { setChordAt } from '../lib/chordProEdit.ts';
import { chordProToSheet, insertChordInSheet, isLossless, sheetToChordPro, snapOutOfBrackets } from '../lib/chordSheet.ts';
import { restoreGeneratedChart, saveEditedChart } from '../lib/chartEdit.ts';
import { type Song, db } from '../lib/db.ts';
import { createHistory } from '../lib/history.ts';
import { Button, IconButton } from '../ui/Button.tsx';

type Format = 'cifra' | 'chordpro';
const FORMAT_KEY = 'wm-edit-format';
const readFormat = (): Format => {
  try {
    return localStorage.getItem(FORMAT_KEY) === 'chordpro' ? 'chordpro' : 'cifra';
  } catch {
    return 'cifra';
  }
};
const toChordPro = (text: string, f: Format) => (f === 'cifra' ? sheetToChordPro(text) : text);
const fromChordPro = (text: string, f: Format) => (f === 'cifra' ? chordProToSheet(text) : text);

/**
 * Edits the lyrics and chords of a song. The text opens filled in, in the usual layout (chords on the
 * line above) or in ChordPro; chords come from a library (or are typed), inserted at the cursor or
 * placed by tapping a word in the preview.
 */
export const EditChart = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [format, setFormat] = useState<Format>(readFormat);
  const history = useRef(createHistory(''));
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [tab, setTab] = useState<'texto' | 'ver'>('texto');
  const [picking, setPicking] = useState<{ line: number; char: number } | null>(null);
  const [inserting, setInserting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [, force] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const ONLY_CHORDPRO = 'Esta cifra tem trechos que só cabem em ChordPro (acordes que o app não reconhece, ou linhas de letra que parecem acordes), então ela abre só em ChordPro para nada se perder.';
  const box = useRef<HTMLTextAreaElement>(null);
  const caret = useRef(0);

  const chordPro = useMemo(() => toChordPro(draft, format), [draft, format]);
  const dirty = chordPro !== saved;

  useEffect(() => {
    void (async () => {
      const [s, chart, analysis] = await Promise.all([db.songs.get(id), db.charts.where('songId').equals(id).first(), db.analyses.where('songId').equals(id).first()]);
      setSong(s ?? null);
      setHasAnalysis(!!analysis);
      const text = chart?.chordPro ?? '';
      // The chord-above layout is used only when the chart comes back from it exactly.
      const f = readFormat() === 'cifra' && !isLossless(text) ? 'chordpro' : readFormat();
      if (f !== readFormat()) setNotice(ONLY_CHORDPRO);
      setFormat(f);
      const shown = fromChordPro(text, f);
      history.current = createHistory(shown);
      setDraft(shown);
      setSaved(text);
      setLoaded(true);
    })();
  }, [id]);

  const update = (next: string) => {
    history.current.set(next);
    setDraft(next);
  };
  const undo = () => {
    history.current.undo();
    setDraft(history.current.value);
    force((n) => n + 1);
  };
  const redo = () => {
    history.current.redo();
    setDraft(history.current.value);
    force((n) => n + 1);
  };

  const switchFormat = (next: Format) => {
    if (next === format) return;
    if (next === 'cifra' && !isLossless(chordPro)) {
      setNotice(ONLY_CHORDPRO);
      return;
    }
    setNotice(null);
    const shown = fromChordPro(chordPro, next);
    history.current = createHistory(shown);
    setDraft(shown);
    setFormat(next);
    try {
      localStorage.setItem(FORMAT_KEY, next);
    } catch {
      /* per-device convenience only */
    }
  };

  const save = useCallback(async () => {
    // Nothing to save before the chart has loaded or when nothing changed (Ctrl+S included).
    if (!loaded || chordPro === saved) return;
    await saveEditedChart(id, chordPro);
    setSaved(chordPro);
    navigate(`/musica/${id}`, { replace: true });
  }, [id, chordPro, saved, loaded, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Undo inside the chord library's own field belongs to that field.
      if (e.target instanceof HTMLInputElement) return;
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

  const usedChords = [...new Set([...chordPro.matchAll(/\[([^\]]+)\]/gu)].map((m) => m[1]!))].slice(0, 16);

  /** Puts the chord where the cursor was: "[G]" in ChordPro, "G " in the chord-above layout. */
  const insertAtCaret = (chord: string) => {
    const at = Math.min(caret.current, draft.length);
    if (format === 'cifra') {
      const next = insertChordInSheet(draft, at, chord);
      update(next.text);
      caret.current = next.caret;
    } else {
      const safe = snapOutOfBrackets(draft, at);
      update(`${draft.slice(0, safe)}[${chord}]${draft.slice(safe)}`);
      caret.current = safe + chord.length + 2;
    }
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(caret.current, caret.current);
    });
  };

  const editor = (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Formato do texto">
          {(
            [
              ['cifra', 'Acordes em cima'],
              ['chordpro', 'ChordPro'],
            ] as const
          ).map(([f, label]) => (
            <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => switchFormat(f)} className={`rounded-md px-3 py-1.5 text-sm ${format === f ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button variant="outline" className="min-h-9 px-3" onClick={() => setInserting(true)}>
          <Music2 className="size-4" /> Inserir acorde
        </Button>
      </div>
      <textarea
        ref={box}
        aria-label={format === 'cifra' ? 'Cifra com os acordes em cima da letra' : 'Cifra em ChordPro'}
        value={draft}
        onChange={(e) => {
          caret.current = e.target.selectionStart;
          update(e.target.value);
        }}
        onSelect={(e) => (caret.current = e.currentTarget.selectionStart)}
        spellCheck={false}
        className="h-[56dvh] w-full resize-y rounded-lg border border-border bg-surface p-3 font-mono text-sm leading-relaxed outline-none focus:border-primary"
      />
      {inserting && (
        <ChordLibrary
          title="Inserir acorde onde está o cursor"
          suggestions={usedChords}
          onCancel={() => setInserting(false)}
          onApply={(chord) => {
            if (chord) insertAtCaret(chord);
            setInserting(false);
          }}
        />
      )}
    </div>
  );

  const preview = (
    <div>
      <div className="h-[60dvh] overflow-auto rounded-lg border border-border p-4">
        <p className="mb-3 text-sm text-muted-foreground">Toque numa palavra para pôr, trocar ou tirar o acorde.</p>
        <ChartView chordPro={chordPro} transpose={0} preferFlats={false} fontSize={16} onPick={(line, char) => setPicking({ line, char })} />
      </div>
      {picking && (
        <ChordLibrary
          title="Acorde nesta sílaba"
          suggestions={usedChords}
          allowRemove
          onCancel={() => setPicking(null)}
          key={`${picking.line}:${picking.char}`}
          onApply={(chord) => {
            const next = setChordAt(chordPro, picking.line, picking.char, chord);
            if (format === 'cifra' && !isLossless(next)) {
              // That chord only fits in ChordPro: switch rather than lose it.
              history.current = createHistory(next);
              setDraft(next);
              setFormat('chordpro');
              setNotice(ONLY_CHORDPRO);
            } else update(fromChordPro(next, format));
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
        <h1 className="mr-auto text-3xl font-bold tracking-tight">Editar letra e acordes</h1>
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
                  setSaved(chordPro);
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
        {format === 'cifra' ? (
          <>
            Escreva os acordes na linha de cima, sobre a sílaba. Seções: <code className="rounded bg-muted px-1">{'{comment: Refrão}'}</code>.
          </>
        ) : (
          <>
            Escreva o acorde entre colchetes antes da sílaba: <code className="rounded bg-muted px-1">[G]Ninguém explica [D]Deus</code>. Seções:{' '}
            <code className="rounded bg-muted px-1">{'{comment: Refrão}'}</code>.
          </>
        )}
      </p>

      {notice && (
        <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      )}

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
