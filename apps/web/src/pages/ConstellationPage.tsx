import { ArrowLeft, Guitar, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChordHelp } from '../components/ChordHelp.tsx';
import { ConstellationView, colorOf, motionLabel, textColorOf } from '../constellation/ConstellationView.tsx';
import { type Motion, type Move, isAltered, centerName, chordKey, chordName, parseChord } from '../constellation/harmony.ts';
import { type StartChoice, StartPicker, startChord } from '../constellation/StartPicker.tsx';
import { type Web, focusOn, openFocus, orbit, resetWeb, startWeb, walk } from '../constellation/web.ts';
import { SilentModeHint, chordEvents, useStudySynth } from '../study/widgets.tsx';
import { Button } from '../ui/Button.tsx';

/** `color`: the line and ring color of the step; `text`: the same color for words (darker on light themes). */
type Step = { name: string; motion: Motion; label: string; why: string; color: string; text: string };

/**
 * The Constelação de acordes: pick a chord, open its orbit and walk through the harmony by relaxing,
 * adding tension and resolving. Tapping a star opens the balloon, where the type of the chord (G, G7,
 * G7(b9)…) is chosen: that choice is an intention, and it shapes the next orbit.
 */
export const ConstellationPage = () => {
  const [start, setStart] = useState<StartChoice>({ pc: 0, mode: 'major' });
  const [web, setWeb] = useState<Web | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Move | null>(null);
  const [help, setHelp] = useState(false);
  const synth = useStudySynth();

  const hear = (id: string, names: string[], beats = 4) => synth.play(id, chordEvents(names, 80, beats));

  // Escape closes the balloon wherever the focus is.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSelected(null);
      setChosen(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  if (!web) {
    return (
      <section className="max-w-xl">
        <Link to="/estudo" className="inline-flex items-center gap-1 text-sm font-semibold text-chord hover:text-primary">
          <ArrowLeft className="size-4" /> Estudo
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="size-7 text-primary" /> Constelação de acordes
        </h1>
        <p className="mt-2 text-muted-foreground">
          Escolha um acorde e veja, em volta dele, para onde a harmonia pode ir: relaxar, tensionar ou resolver. Ande pela constelação ouvindo cada passo, escolhendo o tipo de cada acorde e lendo por que ele funciona.
        </p>
        <StartPicker value={start} onChange={setStart} onStart={() => setWeb(startWeb(parseChord(startChord(start))!))} />
      </section>
    );
  }

  const nameOf = (key: string) => chordName(web.nodes[key]!.chord, web.nodes[key]!.center);
  const focusName = chordName(web.nodes[web.focus]!.chord, web.center);
  const links = orbit(web);
  const picked = links.find((l) => l.to === selected) ?? null;

  const select = (key: string) => {
    const link = links.find((l) => l.to === key);
    // Already open (a hover after choosing a type in the balloon): keep the choice, no replay.
    if (!link || key === selected) return;
    setSelected(key);
    setChosen(link.move);
    hear(`sel-${key}`, [chordName(link.move.to, link.move.nextCenter)]);
  };
  const choose = (move: Move) => {
    setChosen(move);
    hear(`opt-${chordKey(move.to)}-${move.to.quality}`, [chordName(move.to, move.nextCenter)]);
  };
  const go = (move: Move) => {
    const next = walk(web, move);
    const name = chordName(move.to, move.nextCenter);
    setSteps((s) => [...s, { name, motion: move.motion, label: motionLabel(move), why: move.why, color: colorOf(move), text: textColorOf(move) }]);
    setWeb(next);
    setSelected(null);
    setChosen(null);
    hear(`go-${chordKey(move.to)}`, [name]);
  };
  const walkTo = (key: string) => {
    const link = links.find((l) => l.to === key);
    if (link) go(chosen && chordKey(chosen.to) === key ? chosen : link.move);
  };
  const refocus = (key: string) => {
    const next = focusOn(web, key);
    const at = web.trail.indexOf(key);
    setSteps((s) => (at >= 0 ? s.slice(0, at) : [...s, { name: nameOf(key), motion: 'relaxa', label: 'relaxa', why: `Você voltou para ${nameOf(key)} e continua daqui.`, color: 'var(--glow)', text: 'var(--motion-relax-text)' }]));
    setWeb(next);
    setSelected(null);
    setChosen(null);
  };
  const reset = () => {
    setWeb(resetWeb(web));
    setSteps([]);
    setSelected(null);
    setChosen(null);
  };
  const progression = web.trail.map(nameOf);
  const rootName = picked ? chordName({ root: picked.move.to.root, quality: '', ...(picked.move.to.flat ? { flat: true } : {}) }, picked.move.nextCenter) : '';

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
        <div className="relative h-[62dvh] overflow-hidden border-y border-border bg-surface/40 md:h-[calc(100dvh-11rem)] md:rounded-2xl md:border">
          <ConstellationView web={web} selected={selected} onSelect={select} onWalk={walkTo} onFocusStar={refocus} onOpen={() => setWeb(openFocus(web))} />
          {!web.opened && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">Toque no acorde para abrir os caminhos.</p>}

          {picked && chosen && (
            <div
              role="dialog"
              aria-label={`Tipos de ${rootName}`}
              className="absolute inset-x-3 bottom-3 max-h-[70%] overflow-y-auto rounded-2xl border border-border bg-surface/95 p-4 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur md:inset-x-auto md:right-3 md:w-96"
            >
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm text-muted-foreground">Escolha o tipo do acorde: ele muda a intenção do próximo passo.</p>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => {
                    setSelected(null);
                    setChosen(null);
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div role="radiogroup" aria-label={`Tipos de ${rootName}`} className="mt-2 flex flex-wrap gap-1.5">
                {picked.move.options.map((o) => {
                  const name = chordName(o.to, o.nextCenter);
                  const on = o.to.quality === chosen.to.quality;
                  return (
                    <label
                      key={o.to.quality || 'triad'}
                      // Each type in the color of its own move: filled when chosen, outlined otherwise.
                      className="flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-sm font-semibold hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
                      style={on ? { background: colorOf(o), borderColor: colorOf(o), color: 'var(--on-motion)' } : { borderColor: colorOf(o), color: textColorOf(o) }}
                      data-motion={motionLabel(o)}
                    >
                      <input type="radio" name="tipo" className="sr-only" checked={on} onChange={() => choose(o)} aria-label={`${name}, ${o.motion}${o.motion === 'tensiona' && isAltered(o.to) ? ', alterado' : ''}`} />
                      {name}
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-sm">
                <span className="mr-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: colorOf(chosen), color: 'var(--on-motion)' }}>
                  {motionLabel(chosen)}
                </span>
                {chosen.why}
              </p>
              <Button className="mt-3 w-full" onClick={() => go(chosen)}>
                Ir
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-4 px-4 md:px-0">
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
          <SilentModeHint />

          <div>
            <h2 className="text-sm font-semibold">Seu caminho</h2>
            <p data-testid="progression" className="mt-1 font-semibold text-chord">
              {progression.map((name, i) => {
                // Each chord in the color of the step that reached it (the starting chord keeps the chord color).
                const step = i > 0 ? steps[i - 1] : undefined;
                return (
                  <span key={`${i}-${name}`}>
                    {i > 0 && <span className="text-muted-foreground"> → </span>}
                    <span data-testid="chord" data-motion={step?.motion} style={step ? { color: step.text } : undefined}>
                      {name}
                    </span>
                  </span>
                );
              })}
            </p>
            {steps.length > 0 && (
              <p data-testid="pattern" className="mt-1 text-xs text-muted-foreground">
                {steps.map((s) => s.label).join(' → ')}
              </p>
            )}
            <ol aria-label="Caminho" className="mt-3 space-y-2 text-sm">
              {steps.map((s, i) => (
                <li key={`${i}-${s.name}`} className="border-l-2 pl-3" style={{ borderColor: s.color }}>
                  <button type="button" aria-label={`Voltar para ${s.name}`} title={`Voltar para ${s.name}`} onClick={() => refocus(web.trail[i + 1]!)} className="rounded font-semibold underline-offset-4 hover:underline" style={{ color: s.text }}>
                    {s.name}
                  </button>{' '}
                  <span className="text-xs font-semibold" style={{ color: s.text }}>
                    {s.label}
                  </span>{' '}
                  <span className="text-muted-foreground">{s.why}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
      {help && <ChordHelp chord={focusName} onClose={() => setHelp(false)} />}
    </section>
  );
};
