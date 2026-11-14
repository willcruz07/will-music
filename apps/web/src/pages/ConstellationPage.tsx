import { ArrowLeft, Guitar, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChordHelp } from '../components/ChordHelp.tsx';
import { ConstellationView, colorOf, motionLabel, textColorOf } from '../constellation/ConstellationView.tsx';
import { type Motion, type Move, centerName, chordKey, chordName, groupOf, parseChord, RELATION_NAMES } from '../constellation/harmony.ts';
import { type StartChoice, StartPicker, startChord } from '../constellation/StartPicker.tsx';
import { type Web, activeGuide, adoptCenter, focusOn, guidedNext, openFocus, orbit, resetWeb, startGuidedWeb, startWeb, walk } from '../constellation/web.ts';
import { guideEvents, guidesFor } from '../constellation/guides.ts';
import { SheetSelect } from '../ui/SheetSelect.tsx';
import { spellPitch } from '../lib/transpose.ts';
import { SilentModeHint, useStudySynth } from '../study/widgets.tsx';
import { Button } from '../ui/Button.tsx';
import { constellationEvents } from '../constellation/voicing.ts';
import { InversionPicker } from '../constellation/InversionPicker.tsx';
import { chordNotes } from '../lib/chordNotation.ts';

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

  const [selected, setSelected] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Move | null>(null);
  const [help, setHelp] = useState<{ chord: string; anchor?: DOMRect } | null>(null);
  const [guideChoice, setGuideChoice] = useState('');
  const synth = useStudySynth();
  const selectedPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected && window.matchMedia?.('(max-width: 767px)').matches) selectedPanel.current?.scrollIntoView?.({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }, [selected]);

  const hear = (id: string, names: string[], beats = 2) => synth.play(id, constellationEvents(names, 80, beats));
  const steps: Step[] = web?.visits.slice(1).map((visit, index) => {
    const move = web.steps[index + 1];
    return { name: chordName(visit.chord, visit.center), motion: move?.motion ?? 'relaxa', label: move ? motionLabel(move) : 'Retomada', why: move?.why ?? 'Exploração retomada neste acorde, sem inferir uma resolução.', color: move ? colorOf(move) : 'var(--glow)', text: move ? textColorOf(move) : 'var(--motion-relax-text)' };
  }) ?? [];

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
          Escolha um acorde e veja, em volta dele, para onde a harmonia pode ir: manter notas em comum, transformar, preparar ou chegar a outro acorde. Ande pela constelação ouvindo cada passo, escolhendo o tipo de cada acorde e lendo por que ele funciona.
        </p>
        <StartPicker value={start} onChange={setStart} onStart={() => setWeb(startWeb(parseChord(startChord(start))!))} />
      </section>
    );
  }

  const focusName = chordName(web.nodes[web.focus]!.chord, web.center);
  const links = orbit(web);
  const picked = links.find((l) => l.to === selected) ?? null;

  const select = (key: string) => {
    const link = links.find((l) => l.to === key);
    // Already open (a hover after choosing a type in the balloon): keep the choice, no replay.
    if (!link || key === selected) return;
    setSelected(key);
    setChosen(link.move);
  };
  const choose = (move: Move) => {
    synth.stop();
    const bass = chosen?.to.bass;
    if (bass !== undefined && (chordNotes(chordName(move.to, move.nextCenter)) ?? []).includes(bass)) {
      const to = { ...move.to, bass };
      setChosen({ ...move, to, why: `${move.why} Posição: ${chordName(to, move.nextCenter)}.` });
    } else setChosen(move);
  };
  const go = (move: Move) => {
    const next = walk(web, move);
    const name = chordName(move.to, move.nextCenter);

    setWeb(next);
    setSelected(null);
    setChosen(null);
    setHelp(null);
    hear(`go-${chordKey(move.to)}-${move.to.quality}`, [focusName, name]);
  };
  const walkTo = (key: string) => {
    const link = links.find((l) => l.to === key);
    if (link) go(selected === key && chosen ? chosen : link.move);
  };
  const refocus = (key: string, index?: number) => {
    synth.stop();
    setWeb(focusOn(web, key, index));
    setSelected(null); setChosen(null); setHelp(null);
  };
  const reset = () => {
    synth.stop(); setWeb(resetWeb(web)); setSelected(null); setChosen(null); setHelp(null);
  };
  const progression = web.visits.map(visit => chordName(visit.chord, visit.center));
  const rootName = picked ? chordName({ root: picked.move.to.root, quality: '', ...(picked.move.to.flat ? { flat: true } : {}) }, picked.move.nextCenter) : '';
  const focusChord = web.nodes[web.focus]!.chord;
  const guides = guidesFor(web.center);
  const guide = activeGuide(web);
  const nextGuideMove = guidedNext(web);
  const guideId = guides.some(g => g.id === guideChoice) ? guideChoice : guides[0]!.id;
  const canAdopt = ['maj', 'min'].includes(groupOf(focusChord.quality)) && (web.center.root !== focusChord.root || web.center.minor !== (groupOf(focusChord.quality) === 'min'));

  return (
    <section className="-mx-4 md:mx-0">
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-0">
        <Button variant="ghost" className="min-h-9 px-2" onClick={() => { synth.stop(); setWeb(null); setSelected(null); setChosen(null); setHelp(null); }} aria-label="Escolher outro acorde">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">Constelação de acordes</h1>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Centro de referência: {centerName(web.center)}</span>
        {canAdopt && <Button variant="outline" className="min-h-9 text-xs" onClick={() => { synth.stop(); setWeb(adoptCenter(web, { root: focusChord.root, minor: groupOf(focusChord.quality) === 'min' })); setSelected(null); setChosen(null); }}>Adotar {chordName({ root: focusChord.root, quality: groupOf(focusChord.quality) === 'min' ? 'm' : '' }, web.center)} como centro</Button>}
      </div>
      <p className="mt-2 px-4 text-xs text-muted-foreground md:px-0">As ligações são possibilidades de estudo. Uma chegada local não confirma modulação; adote outro centro quando essa for sua intenção. As cores não medem tensão absoluta.</p>
      <div className="mt-4 px-4 md:px-0"><InversionPicker chord={focusChord} center={web.center} title={`Acorde atual: ${focusName} · inversões`} disableCurrent onChange={bass => {
        const to = { ...focusChord, bass };
        go({ to, motion: 'relaxa', relation: 'transformacao', nextCenter: web.center, options: [], why: `${chordName(to, web.center)}: mesmas notas de ${focusName}; ${bass === undefined ? 'fundamental' : chordName({ root: bass, quality: '' }, web.center)} no baixo. A inversão muda a disposição, sem confirmar outra tonalidade.`, ...(web.nodes[web.focus]!.resolvesTo ? { resolvesTo: web.nodes[web.focus]!.resolvesTo } : {}) });
      }} /></div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative h-[62dvh] overflow-hidden border-y border-border bg-surface/40 md:h-[calc(100dvh-11rem)] md:rounded-2xl md:border">
          <ConstellationView web={web} selected={selected} onSelect={select} onWalk={walkTo} onFocusStar={refocus} onOpen={() => setWeb(openFocus(web))} />
          {!web.opened && <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">Toque no acorde para abrir os caminhos.</p>}

        </div>

        <aside className="space-y-4 px-4 md:px-0">
          <div className="space-y-3 rounded-2xl border border-primary/25 bg-surface p-4">
            <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" /> Caminhos guiados</h2>
            <p className="text-xs text-muted-foreground">Percursos conhecidos no centro {centerName(web.center)}. Escolha um desenho para estudar ou continue explorando livremente.</p>
            <SheetSelect label="Escolher caminho guiado" value={guideId} onChange={setGuideChoice} options={guides.map(g => ({ value: g.id, label: g.title, hint: g.about }))} className="w-full" />
            <Button variant="outline" className="w-full" onClick={() => {
              synth.stop(); setWeb(startGuidedWeb(guideId, web.center)); setSelected(null); setChosen(null); setHelp(null);
            }}>Iniciar caminho</Button>
            {guide && <>
              <h3 className="text-sm font-semibold text-chord">{guide.title}</h3>
              <p className="text-sm text-muted-foreground">{guide.about}</p>
              <ol aria-label="Passos do caminho guiado" className="flex flex-wrap gap-1.5">
                {guide.steps.map((s, i) => <li key={i} className="min-w-0">
                  <button type="button" aria-label={`Ver formação de ${chordName(s.chord, web.center)}, passo ${i + 1}`} aria-current={i === web.guide!.cursor ? 'step' : undefined}
                    onClick={e => setHelp({ chord: chordName(s.chord, web.center), anchor: e.currentTarget.getBoundingClientRect() })}
                    className={`flex min-h-11 flex-col rounded-lg border px-2 py-1 text-sm ${i === web.guide!.cursor ? 'border-primary bg-primary/10 text-chord' : 'border-border'}`}>
                    <span className="text-[10px] text-muted-foreground">{s.degree}</span><span className="font-semibold">{chordName(s.chord, web.center)}</span>
                  </button>
                </li>)}
              </ol>
              <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-xs">
                <p><span className="font-semibold">Baixo:</span> {guide.steps.map(s => spellPitch(s.chord.bass ?? s.chord.root, centerName(web.center))).join(' → ')}</p>
                <p><span className="font-semibold">Linha-guia:</span> {guide.steps.map(s => spellPitch((web.center.root + s.melody + 12) % 12, centerName(web.center))).join(' → ')}</p>
                <p className="text-muted-foreground">Uma ideia melódica de estudo, com notas dos acordes. Ouça as notas que ficam e as que caminham; outras melodias também são possíveis.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => synth.play('linha-guia', guideEvents(guide, web.center))}><Play className="size-4" /> Ouvir com linha-guia</Button>
              {nextGuideMove ? <Button className="w-full" onClick={() => go(nextGuideMove)}>Próximo acorde: {chordName(nextGuideMove.to, web.center)}</Button>
                : <p role="status" className="text-sm font-semibold text-chord">Caminho concluído. Recomece para comparar as vozes ou explore outra saída.</p>}
              <p className="text-xs text-muted-foreground">{nextGuideMove && chordKey(nextGuideMove.to) === web.focus ? 'Neste passo, a qualidade muda na mesma estrela. Use “Próximo acorde” para ouvir a transformação.' : 'O aro externo destaca o próximo passo.'} Escolher outra saída libera a exploração; o histórico continua disponível.</p>
              <Button variant="ghost" className="w-full text-xs" onClick={() => { synth.stop(); setWeb(openFocus({ ...web, guide: undefined })); }}>Explorar livremente</Button>
            </>}
          </div>
          {picked && chosen && (
            <div
              ref={selectedPanel}
              role="dialog"
              aria-label={`Tipos de ${rootName}`}
              className="rounded-2xl border border-primary/40 bg-surface p-4 shadow-lg"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Próximo acorde</p><h2 className="text-2xl font-semibold text-chord">{chordName(chosen.to, chosen.nextCenter)}</h2><p className="mt-1 text-xs text-muted-foreground">Escolha primeiro o baixo e, se desejar, outra qualidade.</p></div>
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
              <div className="mt-3"><InversionPicker chord={chosen.to} center={chosen.nextCenter} title="Inversões do próximo acorde" onChange={bass => {
                synth.stop();
                const to = { ...chosen.to, bass };
                const baseWhy = picked.move.options.find(option => option.to.quality === chosen.to.quality)?.why ?? picked.move.why;
                setChosen({ ...chosen, to, why: `${baseWhy} Posição: ${chordName(to, chosen.nextCenter)}.`, options: [] });
              }} /></div>
              <h3 className="mt-4 text-sm font-semibold">Qualidade e extensões</h3>
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
                      <input type="radio" name="tipo" className="sr-only" checked={on} onChange={() => choose(o)} aria-label={`${name}, ${motionLabel(o)}`} />
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
              {chosen.relation && <p className="mt-2 text-xs font-semibold text-chord">{RELATION_NAMES[chosen.relation]}</p>}
              {chosen.localTarget && <p className="mt-1 text-xs text-muted-foreground">Destino / chegada local: {chordName(chosen.localTarget, web.center)} · referência: {centerName(web.center)}</p>}
              <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => hear('transicao', [focusName, chordName(chosen.to, chosen.nextCenter)])}>Ouvir transição</Button><Button variant="outline" onClick={() => hear('acorde', [chordName(chosen.to, chosen.nextCenter)])}>Ouvir acorde</Button></div>
              <Button className="mt-3 w-full" onClick={() => go(chosen)}>
                Ir
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-9 px-3" onClick={() => hear('trilha', progression, 2)}>
              <Play className="size-4" /> Ouvir o caminho
            </Button>
            <Button variant="outline" className="min-h-9 px-3" onClick={e => setHelp({ chord: focusName, anchor: e.currentTarget.getBoundingClientRect() })}>
              <Guitar className="size-4" /> Como tocar
            </Button>
            <Button variant="outline" className="min-h-9 px-3" onClick={reset}>
              <RotateCcw className="size-4" /> Recomeçar
            </Button>
          </div>
          <SilentModeHint />
          <p className="text-xs text-muted-foreground">Voicings de estudo: notas comuns e movimentos próximos são favorecidos. O baixo e todas as notas da fórmula são preservados; isso não substitui um arranjo completo.</p>

          <div>
            <h2 className="text-sm font-semibold">Seu caminho</h2>
            <p className="mt-1 text-xs text-muted-foreground">Toque nas cifras para ver as formações. No diário abaixo, toque no nome para retomar daquele ponto.</p>
            <p data-testid="progression" className="mt-1 font-semibold text-chord">
              {progression.map((name, i) => {
                // Each chord in the color of the step that reached it (the starting chord keeps the chord color).
                const step = i > 0 ? steps[i - 1] : undefined;
                return (
                  <span key={`${i}-${name}`}>
                    {i > 0 && <span className="text-muted-foreground"> → </span>}
                    <button type="button" data-testid="chord" aria-label={`Ver formação de ${name}`} className="min-h-10 rounded px-1 underline decoration-dotted underline-offset-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" onClick={e => setHelp({ chord: name, anchor: e.currentTarget.getBoundingClientRect() })} data-motion={step?.motion} style={step ? { color: step.text } : undefined}>
                      {name}
                    </button>
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
                  <button type="button" aria-label={`Voltar para ${s.name}`} title={`Voltar para ${s.name}`} onClick={() => refocus(web.trail[i + 1]!, i + 1)} className="rounded font-semibold underline-offset-4 hover:underline" style={{ color: s.text }}>
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
      {help && <ChordHelp key={help.chord} chord={help.chord} anchor={help.anchor} onClose={() => setHelp(null)} strict showStudyLink={false} />}
    </section>
  );
};
