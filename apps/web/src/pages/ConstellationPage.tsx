import { ArrowLeft, Guitar, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChordHelp } from '../components/ChordHelp.tsx';
import { ConstellationView } from '../constellation/ConstellationView.tsx';
import { type Chord, type Family, type Move, type Quality, QUALITIES, centerName, chordKey, chordName, parseChord } from '../constellation/harmony.ts';
import { suggestRoute } from '../constellation/route.ts';
import { type Web, focusOn, openFocus, orbit, resetWeb, startWeb, walk } from '../constellation/web.ts';
import { chordEvents, useStudySynth } from '../study/widgets.tsx';
import { Button } from '../ui/Button.tsx';
import { SheetSelect } from '../ui/SheetSelect.tsx';

const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALITY_NAMES: Record<Quality, string> = {
  '7M': 'Sétima maior',
  '': 'Maior',
  '6': 'Sexta',
  m7: 'Menor com sétima',
  m: 'Menor',
  m6: 'Menor com sexta',
  'm(7M)': 'Menor com sétima maior',
  '7': 'Sétima (dominante)',
  '7sus4': 'Sétima com quarta suspensa',
  'm7(b5)': 'Meio-diminuto',
  '°7': 'Diminuto com sétima',
};
const FAMILY_LABEL: Record<Family, string> = { tonica: 'tônica', subdominante: 'subdominante', dominante: 'dominante', alterado: 'alterado' };
const MAX_STEPS = 8;

const rootOptions = ROOTS.map((r) => ({ value: r, label: r }));
const toOption = (q: Quality) => ({ value: q, label: QUALITY_NAMES[q], hint: q ? `ex.: C${q}` : 'ex.: C' });
const qualityOptions = QUALITIES.map(toOption);
/** Only the chord types the constellation ever lands on: a target it can never reach would always fail. */
const TARGET_QUALITIES: Quality[] = ['7M', 'm7', '7', 'm6', 'm7(b5)', '°7'];
const targetOptions = TARGET_QUALITIES.map(toOption);

type Step = { name: string; why: string };

/** The Constelação de acordes: pick a chord, open its orbit and walk through the harmony, hearing and reading each step. */
export const ConstellationPage = () => {
  const [root, setRoot] = useState('C');
  const [quality, setQuality] = useState<Quality>('7M');
  const [web, setWeb] = useState<Web | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [targetRoot, setTargetRoot] = useState('');
  const [targetQuality, setTargetQuality] = useState<Quality | null>(null);
  const [help, setHelp] = useState(false);
  const synth = useStudySynth();

  const nameOf = (w: Web, key: string) => chordName(w.nodes[key]!.chord, w.center);
  const hear = (id: string, names: string[], beats = 4) => synth.play(id, chordEvents(names, 80, beats));

  const target: Chord | null = targetRoot && targetQuality !== null ? parseChord(`${targetRoot}${targetQuality}`) : null;
  const suggestion = useMemo(() => {
    if (!web || !target) return null;
    const focus = web.nodes[web.focus]!;
    const targetName = chordName(target, web.center);
    if (chordKey(focus.chord) === chordKey(target)) return { text: `Você já está em ${targetName}.`, keys: [] as string[], steps: [] as Move[] };
    const route = suggestRoute(focus.chord, web.center, target, MAX_STEPS);
    if (!route) return { text: `Não encontrei um caminho até ${targetName} em ${MAX_STEPS} passos.`, keys: [], steps: [] };
    const names = [nameOf(web, web.focus), ...route.map((m) => chordName(m.to, m.nextCenter))];
    return { text: `Sugestão até ${targetName}: ${names.join(' → ')}`, keys: route.map((m) => chordKey(m.to)).filter((k) => web.nodes[k]), steps: route };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web, targetRoot, targetQuality]);

  if (!web) {
    return (
      <section className="max-w-xl">
        <Link to="/estudo" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Estudo
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="size-7 text-primary" /> Constelação de acordes
        </h1>
        <p className="mt-2 text-muted-foreground">
          Escolha um acorde e veja, em volta dele, os caminhos que soam bem: dominantes, substitutos de trítono, ii–V, empréstimos, diminutos. Ande pela constelação ouvindo cada passo e lendo por que ele funciona.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Acorde de partida</span>
            <span className="flex gap-2">
              <SheetSelect label="Fundamental" value={root} onChange={setRoot} options={rootOptions} className="w-20" />
              <SheetSelect label="Tipo" value={quality} onChange={(q) => setQuality(q as Quality)} options={qualityOptions} className="w-56" />
            </span>
          </label>
          <Button onClick={() => setWeb(startWeb(parseChord(`${root}${quality}`)!))}>Começar</Button>
        </div>
      </section>
    );
  }

  const focusName = nameOf(web, web.focus);
  const links = orbit(web);
  const picked = links.find((l) => l.to === selected) ?? null;

  const select = (key: string) => {
    setSelected(key);
    hear(`sel-${key}`, [nameOf(web, key)]);
  };
  const go = (move: Move) => {
    const next = walk(web, move);
    setSteps((s) => [...s, { name: nameOf(next, next.focus), why: move.why }]);
    setWeb(next);
    setSelected(null);
    hear(`go-${chordKey(move.to)}`, [nameOf(next, next.focus)]);
  };
  const walkTo = (key: string) => {
    const link = links.find((l) => l.to === key);
    if (link) go(link.move);
  };
  const refocus = (key: string) => {
    const next = focusOn(web, key);
    const at = web.trail.indexOf(key);
    setSteps((s) => (at >= 0 ? s.slice(0, at) : [...s, { name: nameOf(next, key), why: `Você voltou para ${nameOf(next, key)} e continua daqui.` }]));
    setWeb(next);
    setSelected(null);
  };
  const reset = () => {
    setWeb(resetWeb(web));
    setSteps([]);
    setSelected(null);
  };
  const progression = web.trail.map((k) => nameOf(web, k));

  return (
    <section className="-mx-4 md:mx-0">
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-0">
        <Button variant="ghost" className="min-h-9 px-2" onClick={() => setWeb(null)} aria-label="Escolher outro acorde">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Constelação de acordes</h1>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Centro tonal: {centerName(web.center)}</span>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative h-[58dvh] overflow-hidden border-y border-border bg-surface/40 md:h-[calc(100dvh-11rem)] md:rounded-2xl md:border">
          <ConstellationView
            web={web}
            selected={selected}
            route={suggestion?.keys ?? []}
            onSelect={select}
            onWalk={walkTo}
            onFocusStar={refocus}
            onOpen={() => setWeb(openFocus(web))}
          />
          {!web.opened && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">Toque no acorde para abrir os caminhos.</p>}
        </div>

        <aside className="space-y-4 px-4 md:px-0">
          {picked && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4" aria-live="polite">
              <p className="text-lg font-bold text-chord">{nameOf(web, picked.to)}</p>
              <p className="text-xs text-muted-foreground">{FAMILY_LABEL[picked.move.family]}</p>
              <p className="mt-2 text-sm">{picked.move.why}</p>
              {picked.move.variants.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Outras cores do mesmo acorde">
                  {picked.move.variants.map((v) => (
                    <button key={v} type="button" onClick={() => hear(`var-${v}`, [v])} className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold text-chord">
                      {v}
                    </button>
                  ))}
                </div>
              )}
              <Button className="mt-3 w-full" onClick={() => go(picked.move)}>
                Ir
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-9 px-3" onClick={() => hear('trilha', progression, 2)}>
              <Play className="size-4" /> Ouvir o caminho
            </Button>
            <Button variant="outline" className="min-h-9 px-3" onClick={() => setHelp(true)}>
              <Guitar className="size-4" /> Como tocar
            </Button>
            <Button variant="outline" className="min-h-9 px-3" onClick={reset}>
              <RotateCcw className="size-4" /> Recomeçar
            </Button>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Seu caminho</h2>
            <p data-testid="progression" className="mt-1 font-semibold text-chord">
              {progression.join(' → ')}
            </p>
            <ol aria-label="Caminho" className="mt-2 space-y-2 text-sm">
              {steps.map((s, i) => (
                <li key={`${i}-${s.name}`} className="border-l-2 border-primary/50 pl-3">
                  <button type="button" aria-label={`Voltar para ${s.name}`} title={`Voltar para ${s.name}`} onClick={() => refocus(web.trail[i + 1]!)} className="rounded font-semibold text-chord underline-offset-4 hover:underline">
                    {s.name}
                  </button> <span className="text-muted-foreground">{s.why}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h2 className="text-sm font-semibold">Chegar em um acorde</h2>
            <p className="mt-1 text-xs text-muted-foreground">Escolha um destino e veja um caminho que tensiona e resolve até ele.</p>
            <div className="mt-2 flex gap-2">
              <SheetSelect label="Alvo: fundamental" value={targetRoot} onChange={setTargetRoot} options={rootOptions} className="w-20" />
              <SheetSelect
                label="Alvo: tipo"
                value={targetQuality ?? 'none'}
                onChange={(q) => setTargetQuality(q as Quality)}
                options={targetOptions}
                className="min-w-0 flex-1"
                renderValue={(o) => o?.label ?? 'Escolha'}
              />
            </div>
            {suggestion && (
              <div className="mt-3 text-sm" aria-live="polite">
                <p data-testid="suggestion">{suggestion.text}</p>
                {suggestion.steps.length > 0 && (
                  <ol aria-label="Passos sugeridos" className="mt-2 space-y-1.5">
                    {suggestion.steps.map((m, i) => (
                      <li key={`${i}-${chordKey(m.to)}`} className="border-l-2 border-[var(--chord)]/50 pl-3">
                        <span className="font-semibold text-chord">{chordName(m.to, m.nextCenter)}</span> <span className="text-muted-foreground">{m.why}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
            {target && (
              <button
                type="button"
                className="mt-2 text-xs text-muted-foreground underline underline-offset-4"
                onClick={() => {
                  setTargetRoot('');
                  setTargetQuality(null);
                }}
              >
                Limpar alvo
              </button>
            )}
          </div>
        </aside>
      </div>
      {help && <ChordHelp chord={focusName} onClose={() => setHelp(false)} />}
    </section>
  );
};
