import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Camera, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, clamp, sliderToZoom, zoomAround, zoomToSlider } from './camera.ts';
import { type Motion, type Move, chordKey, chordName, isAltered } from './harmony.ts';
import { type Web, guidedNext, orbit, previewStars } from './web.ts';

export const MOTION_COLOR: Record<Motion, string> = { resolve: 'var(--primary)', tensiona: '#f59e0b', relaxa: 'var(--glow)' };
export const ALTERED_COLOR = '#f472b6';
export const TRANSFORM_COLOR = '#a78bfa';
/** Motion color, with altered tensions (b9, #5, °7) in pink so the spice of the reharmonization stands out. */
const transformed = (m: Move) => m.relation === 'transformacao' || m.relation === 'substituicao';
export const colorOf = (m: Move): string => transformed(m) ? TRANSFORM_COLOR : m.motion === 'tensiona' && isAltered(m.to) ? ALTERED_COLOR : MOTION_COLOR[m.motion];

const MOTION_TEXT: Record<Motion, string> = { resolve: 'var(--motion-resolve-text)', tensiona: 'var(--motion-tension-text)', relaxa: 'var(--motion-relax-text)' };
/** The move in words, telling an altered tension apart from a plain one (the four colors of the legend). */
export const motionLabel = (m: Move): string => {
  if (m.relation === 'transformacao') return 'Transformação';
  if (m.relation === 'substituicao') return 'Substituição';
  if (m.motion === 'resolve') return 'Chegada local';
  if (m.motion === 'tensiona') return isAltered(m.to) ? 'Tensão com alteração' : 'Preparação / tensão';
  if (m.relation === 'emprestimo') return 'Empréstimo modal';
  if (m.relation === 'notas-comuns') return 'Notas em comum';
  return 'Continuidade';
};

/** The same color for text (chord names): a darker tone on light themes, so it reads on white. */
export const textColorOf = (m: Move): string => transformed(m) ? 'var(--motion-transform-text)' : m.motion === 'tensiona' && isAltered(m.to) ? 'var(--motion-altered-text)' : MOTION_TEXT[m.motion];

/** The legend always shows the four actions. */
const LEGEND: { label: string; color: string }[] = [
  { label: 'Chegada local', color: MOTION_COLOR.resolve },
  { label: 'Preparação / tensão', color: MOTION_COLOR.tensiona },
  { label: 'Tensão com alteração', color: ALTERED_COLOR },
  { label: 'Continuidade / notas comuns', color: MOTION_COLOR.relaxa },
  { label: 'Transformação / substituição', color: TRANSFORM_COLOR },
];

const TAP_SLOP = 8;

/**
 * The constellation on screen: the star in focus in the middle, its orbit (walkable), a dim preview ring
 * one step further, the trail walked, and every other opened star. Drag to pan; wheel, pinch or the zoom bar
 * (−, slider, +, center) to zoom;
 * the camera flies to the focus when it changes. A tap that moved more than a few pixels is a drag.
 */
export const ConstellationView = ({
  web,
  selected,
  onSelect,
  onWalk,
  onFocusStar,
  onOpen,
}: {
  web: Web;
  selected: string | null;
  onSelect: (key: string) => void;
  onWalk: (key: string) => void;
  onFocusStar: (key: string) => void;
  onOpen: () => void;
}) => {
  const box = useRef<HTMLDivElement>(null);
  const arrowId = `constellation-arrow-${useId().replace(/:/g, '')}`;
  const recommended = guidedNext(web);
  const recommendedKey = recommended ? chordKey(recommended.to) : null;
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  // Distance and midpoint of the two fingers at the last move of a pinch.
  const pinch = useRef<{ d: number; mx: number; my: number } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const links = orbit(web);
  const ring = useMemo(() => previewStars(web), [web]);
  const focus = web.nodes[web.focus]!;
  const orbitKeys = new Set(links.map((l) => l.to));
  const trailSet = new Set(web.trail);

  // Keep the active orbit readable; an ever-growing trail must not shrink the mobile view.
  const fit = () => {
    const pts = [focus, ...links.map((l) => web.nodes[l.to]!)];
    const span = Math.max(1, ...pts.map((p) => Math.max(Math.abs(p.x - focus.x), Math.abs(p.y - focus.y)))) + 90;
    setCamera({ x: focus.x, y: focus.y, zoom: clamp(Math.min(size.w, size.h) / 2 / span, MIN_ZOOM, MAX_ZOOM) });
  };
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web.focus, web.opened, size.w, size.h]);

  /** Screen point of a pointer, relative to the view's top-left. */
  const local = (x: number, y: number) => {
    const r = box.current?.getBoundingClientRect();
    return { x: x - (r?.left ?? 0), y: y - (r?.top ?? 0) };
  };
  const zoomBy = (factor: number) => setCamera((c) => zoomAround(c, factor, { x: size.w / 2, y: size.h / 2 }, size));

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > TAP_SLOP) moved.current = true;
    if (!moved.current) return;
    setDragging(true);
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const mid = local((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      const last = pinch.current;
      pinch.current = { d, mx: mid.x, my: mid.y };
      // Read before updating: the camera update runs later, when pinch.current already holds this move.
      if (!last || last.d < 1) return;
      const factor = d / last.d;
      const panX = mid.x - last.mx;
      const panY = mid.y - last.my;
      setCamera((c) => {
        const z = zoomAround(c, factor, mid, size);
        return { ...z, x: z.x - panX / z.zoom, y: z.y - panY / z.zoom };
      });
      return;
    }
    if (pinch.current) return; // one finger lifted after a pinch: wait for it to end, no jump
    setCamera((c) => ({ ...c, x: c.x - (e.clientX - prev.x) / c.zoom, y: c.y - (e.clientY - prev.y) / c.zoom }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      pinch.current = null;
      setDragging(false);
    }
  };
  // Wheel zoom: a native, non-passive listener so the page behind does not scroll; no camera easing while wheeling.
  const [wheeling, setWheeling] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setWheeling(true);
      clearTimeout(timer);
      timer = window.setTimeout(() => setWheeling(false), 200);
      setCamera((c) => ({ ...c, zoom: clamp(c.zoom * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM) }));
    };
    // iPhone/iPad: Safari's own pinch gestures would zoom the whole page instead of the constellation.
    const noPageZoom = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) el.addEventListener(type, noPageZoom, { passive: false });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
      for (const type of ['gesturestart', 'gesturechange', 'gestureend']) el.removeEventListener(type, noPageZoom);
    };
  }, []);

  /** A tap, unless the pointer travelled: then it was a drag and does nothing. */
  const tap = (fn: () => void) => () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    fn();
  };

  const onOrbitKey = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Like a tap: the first press selects (opens the balloon), the second walks.
      if (selected === key) onWalk(key);
      else onSelect(key);
      return;
    }
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const items = [...(box.current?.querySelectorAll<SVGElement>('[data-orbit]') ?? [])];
    const i = items.indexOf(e.currentTarget as SVGElement);
    const next = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    next?.focus();
    const k = next?.getAttribute('data-key');
    if (k) onSelect(k);
  };

  /** Color of trail step i: the start in the main color, a jump back to an opened star as a relax, else its move. */
  const stepColor = (i: number): string => {
    if (i <= 0) return 'var(--primary)';
    const move = web.steps[i];
    return move ? colorOf(move) : MOTION_COLOR.relaxa;
  };
  /** Fill of a star already walked (its latest visit; the starting chord always keeps the start color), else undefined. */
  const starColor = (key: string): string | undefined => {
    if (!trailSet.has(key)) return undefined;
    return web.trail[0] === key ? stepColor(0) : stepColor(web.trail.lastIndexOf(key));
  };

  // The chord in focus in the color of the step that reached it; the starting chord always keeps the start color.
  const focusColor = web.focus === web.trail[0] ? stepColor(0) : stepColor(web.trail.length - 1);

  /** Each star is spelled in the center it lives in (the same spelling the diary and the balloon use). */
  const name = (key: string) => {
    const n = web.nodes[key]!;
    return key === web.focus ? chordName(n.chord, web.center) : chordName(n.chord, n.center);
  };

  return (
    <div ref={box} className="relative h-full w-full touch-none select-none overflow-hidden">
      <svg
        className={`h-full w-full ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        viewBox={`0 0 ${size.w} ${size.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="group"
        aria-label={`Constelação a partir de ${name(web.focus)}`}
      >
        <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" /></marker></defs>
        <g
          className={dragging || wheeling ? '' : 'transition-transform duration-[450ms] ease-out motion-reduce:transition-none'}
          style={{ transform: `translate(${size.w / 2}px, ${size.h / 2}px) scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)` }}
        >
          {/* Links of every opened star, dim; the orbit's links brighter. */}
          {web.links.map((l) => {
            const a = web.nodes[l.from]!;
            const b = web.nodes[l.to]!;
            const live = l.from === web.focus;
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            if (length < 1) return null;
            const dx = (b.x - a.x) / length; const dy = (b.y - a.y) / length;
            const inset = l.to === web.focus ? 50 : live ? 42 : 30;
            return <line key={`${l.from}-${l.to}`} x1={a.x + dx * (live ? 50 : 30)} y1={a.y + dy * (live ? 50 : 30)} x2={b.x - dx * inset} y2={b.y - dy * inset} markerEnd={live ? `url(#${arrowId})` : undefined} strokeDasharray={l.move.relation === 'notas-comuns' ? '5 4' : undefined} stroke={live ? colorOf(l.move) : 'var(--border)'} strokeOpacity={live ? 0.7 : 0.5} strokeWidth={live && l.to === recommendedKey ? 3.5 : live ? 2 : 1} />;
          })}

          <g data-testid="preview-ring" opacity={0.35}>
            {ring.map((s, i) => {
              const from = web.nodes[s.from]!;
              return <line key={`${s.from}-${s.key}-${i}`} data-star={s.key} x1={from.x} y1={from.y} x2={s.x} y2={s.y} stroke="var(--border)" strokeDasharray="3 4" />;
            })}
            {/* One bubble per chord, even when several neighbors lead to it. */}
            {[...new Map(ring.filter((s) => !web.nodes[s.key]).map((s) => [s.key, s])).values()].map((s) => (
              <g key={s.key} data-bubble={s.key}>
                <circle cx={s.x} cy={s.y} r={20} fill="var(--surface)" stroke={colorOf(s.move)} strokeDasharray="3 3" />
                <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                  {chordName(s.chord, s.center)}
                </text>
              </g>
            ))}
          </g>

          {/* The trail walked so far: each segment in the color of the step it was (a star visited twice keeps both). */}
          <g data-testid="trail">
            {web.trail.slice(1).map((k, i) => {
              const a = web.nodes[web.trail[i]!]!;
              const b = web.nodes[k]!;
              return <line key={`seg-${i}`} data-step={i + 1} data-color={stepColor(i + 1)} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stepColor(i + 1)} strokeWidth={4} strokeLinecap="round" />;
            })}
          </g>

          {Object.values(web.nodes).map((n) => {
            if (n.key === web.focus || orbitKeys.has(n.key)) return null;
            // A star already walked is filled with the color of the step that reached it, the chord in contrast.
            const walked = starColor(n.key);
            return (
              <g key={n.key} role="button" tabIndex={0} aria-label={`${name(n.key)}, voltar a este acorde`} className="cursor-pointer" onClick={tap(() => onFocusStar(n.key))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFocusStar(n.key); } }}>
                <circle data-key={n.key} data-color={walked} cx={n.x} cy={n.y} r={walked ? 26 : 22} fill={walked ?? 'var(--surface)'} stroke={walked ?? 'var(--border)'} strokeWidth={1} opacity={walked ? 1 : 0.5} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={walked ? 12 : 11} fontWeight={walked ? 700 : 400} fill={walked ? 'var(--on-motion)' : 'var(--muted-foreground)'}>
                  {name(n.key)}
                </text>
              </g>
            );
          })}

          {links.map((l, i) => {
            const n = web.nodes[l.to]!;
            const label = chordName(l.move.to, l.move.nextCenter);
            const sel = selected === l.to;
            // Already on the trail: filled with that step's color; the ring keeps the color of this move.
            const walked = starColor(l.to);
            return (
              <g
                key={l.to}
                role="button"
                tabIndex={i === 0 ? 0 : -1}
                data-orbit=""
                data-key={l.to}
                  aria-label={`${label}, ${motionLabel(l.move)}${l.to === recommendedKey ? ', próximo passo guiado' : ''}`}
                aria-pressed={sel}
                className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[var(--foreground)]"
                onClick={tap(() => (sel ? onWalk(l.to) : onSelect(l.to)))}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onSelect(l.to)}
                onKeyDown={(e) => onOrbitKey(e, l.to)}
              >
                {l.to === recommendedKey && <circle data-testid="guided-star" cx={n.x} cy={n.y} r={46} fill="none" stroke="var(--primary)" strokeWidth={2} strokeDasharray="4 4" pointerEvents="none" />}
                <circle data-key={walked ? l.to : undefined} data-color={walked} cx={n.x} cy={n.y} r={sel ? 38 : 32} fill={walked ?? 'var(--surface)'} stroke={colorOf(l.move)} strokeWidth={sel ? 4 : walked ? 3.5 : 2.5} />
                <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize={Math.max(9, Math.min(15, 95 / label.length))} fontWeight={700} fill={walked ? 'var(--on-motion)' : textColorOf(l.move)} data-label={l.to}>
                  {label}
                </text>
              </g>
            );
          })}

          {web.opened ? (
            <g>
              <circle data-focus={web.focus} data-color={focusColor} cx={focus.x} cy={focus.y} r={46} fill={focusColor} />
              <text x={focus.x} y={focus.y + 7} textAnchor="middle" fontSize={Math.max(10, Math.min(22, 130 / name(web.focus).length))} fontWeight={800} fill="var(--on-motion)">
                {name(web.focus)}
              </text>
            </g>
          ) : (
            <g role="button" tabIndex={0} aria-label={`Abrir os caminhos de ${name(web.focus)}`} className="cursor-pointer outline-none" onClick={tap(onOpen)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen()}>
              <circle cx={focus.x} cy={focus.y} r={52} fill="var(--primary)" className="animate-pulse motion-reduce:animate-none" />
              <text x={focus.x} y={focus.y + 8} textAnchor="middle" fontSize={24} fontWeight={800} fill="var(--primary-foreground)">
                {name(web.focus)}
              </text>
            </g>
          )}
        </g>
      </svg>
      {/* Zoom bar: for phones where pinching is awkward, and as a visible way to zoom anywhere. */}
      <div
        role="toolbar"
        aria-label="Zoom da constelação"
        className="absolute right-2 top-2 flex items-center gap-0.5 rounded-xl border border-border bg-background/80 p-1 shadow-sm backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Diminuir o zoom" disabled={camera.zoom <= MIN_ZOOM + 1e-3} onClick={() => zoomBy(1 / ZOOM_STEP)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40">
          <ZoomOut className="size-4" />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={zoomToSlider(camera.zoom)}
          aria-label="Zoom"
          aria-valuetext={`${Math.round(camera.zoom * 100)}%`}
          onChange={(e) => {
            const zoom = sliderToZoom(Number(e.target.value));
            setCamera((c) => zoomAround(c, zoom / c.zoom, { x: size.w / 2, y: size.h / 2 }, size));
          }}
          className="w-20 accent-[var(--primary)] sm:w-28"
        />
        <button type="button" aria-label="Aumentar o zoom" disabled={camera.zoom >= MAX_ZOOM - 1e-3} onClick={() => zoomBy(ZOOM_STEP)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40">
          <ZoomIn className="size-4" />
        </button>
        <button type="button" aria-label="Centralizar no acorde" onClick={fit} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
          <LocateFixed className="size-4" />
        </button>
      </div>
      {/* Legend: the sectors present in the current orbit (Resolver only when the focus is a tension). */}
      {web.opened && (
        <ul aria-label="Movimentos" className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-xl bg-background/70 px-2.5 py-2 text-xs backdrop-blur">
          {LEGEND.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
