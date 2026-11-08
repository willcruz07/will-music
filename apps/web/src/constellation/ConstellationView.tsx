import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Family, chordName } from './harmony.ts';
import { type Web, orbit, previewStars } from './web.ts';

const FAMILY_LABEL: Record<Family, string> = { tonica: 'tônica', subdominante: 'subdominante', dominante: 'dominante', alterado: 'alterado' };
const FAMILY_COLOR: Record<Family, string> = { tonica: 'var(--primary)', subdominante: 'var(--glow)', dominante: '#f59e0b', alterado: '#f472b6' };

const TAP_SLOP = 8;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Camera = { x: number; y: number; zoom: number };

/**
 * The constellation on screen: the star in focus in the middle, its orbit (walkable), a dim preview ring
 * one step further, the trail walked, and every other opened star. Drag to pan, wheel or pinch to zoom;
 * the camera flies to the focus when it changes. A tap that moved more than a few pixels is a drag.
 */
export const ConstellationView = ({
  web,
  selected,
  route = [],
  onSelect,
  onWalk,
  onFocusStar,
  onOpen,
}: {
  web: Web;
  selected: string | null;
  route?: string[];
  onSelect: (key: string) => void;
  onWalk: (key: string) => void;
  onFocusStar: (key: string) => void;
  onOpen: () => void;
}) => {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const pinch = useRef<number | null>(null);

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

  // Fly to the focus and zoom out enough to keep the trail and the orbit in view.
  useEffect(() => {
    const pts = [...web.trail.map((k) => web.nodes[k]!), ...links.map((l) => web.nodes[l.to]!)];
    const span = Math.max(1, ...pts.map((p) => Math.max(Math.abs(p.x - focus.x), Math.abs(p.y - focus.y)))) + 90;
    setCamera({ x: focus.x, y: focus.y, zoom: clamp(Math.min(size.w, size.h) / 2 / span, MIN_ZOOM, MAX_ZOOM) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web.focus, web.opened, size.w, size.h]);

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
      if (pinch.current) setCamera((c) => ({ ...c, zoom: clamp((c.zoom * d) / pinch.current!, MIN_ZOOM, MAX_ZOOM) }));
      pinch.current = d;
      return;
    }
    setCamera((c) => ({ ...c, x: c.x - (e.clientX - prev.x) / c.zoom, y: c.y - (e.clientY - prev.y) / c.zoom }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
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
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel);
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
      onWalk(key);
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

  const name = (key: string) => {
    const n = web.nodes[key]!;
    return chordName(n.chord, web.center);
  };
  const routeLine = [web.focus, ...route].map((k) => web.nodes[k]).filter(Boolean);

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
        <g
          className={dragging || wheeling ? '' : 'transition-transform duration-[450ms] ease-out motion-reduce:transition-none'}
          style={{ transform: `translate(${size.w / 2}px, ${size.h / 2}px) scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)` }}
        >
          {/* Links of every opened star, dim; the orbit's links brighter. */}
          {web.links.map((l) => {
            const a = web.nodes[l.from]!;
            const b = web.nodes[l.to]!;
            const live = l.from === web.focus;
            return <line key={`${l.from}-${l.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={live ? FAMILY_COLOR[l.move.family] : 'var(--border)'} strokeOpacity={live ? 0.55 : 0.5} strokeWidth={live ? 2 : 1} />;
          })}

          <g data-testid="preview-ring" opacity={0.35}>
            {ring.map((s, i) => {
              const from = web.nodes[s.from]!;
              return <line key={`${s.from}-${s.key}-${i}`} data-star={s.key} x1={from.x} y1={from.y} x2={s.x} y2={s.y} stroke="var(--border)" strokeDasharray="3 4" />;
            })}
            {/* One bubble per chord, even when several neighbors lead to it. */}
            {[...new Map(ring.filter((s) => !web.nodes[s.key]).map((s) => [s.key, s])).values()].map((s) => (
              <g key={s.key} data-bubble={s.key}>
                <circle cx={s.x} cy={s.y} r={20} fill="var(--surface)" stroke={FAMILY_COLOR[s.move.family]} strokeDasharray="3 3" />
                <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                  {chordName(s.chord, s.center)}
                </text>
              </g>
            ))}
          </g>

          {/* The trail walked so far, and the suggested route in target mode. */}
          {web.trail.length > 1 && (
            <polyline points={web.trail.map((k) => `${web.nodes[k]!.x},${web.nodes[k]!.y}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {routeLine.length > 1 && (
            <polyline data-testid="route" points={routeLine.map((n) => `${n!.x},${n!.y}`).join(' ')} fill="none" stroke="var(--chord)" strokeWidth={2.5} strokeDasharray="8 6" />
          )}

          {Object.values(web.nodes).map((n) => {
            if (n.key === web.focus || orbitKeys.has(n.key)) return null;
            return (
              <g key={n.key} role="button" aria-label={`${name(n.key)}, voltar a este acorde`} className="cursor-pointer" onClick={tap(() => onFocusStar(n.key))}>
                <circle cx={n.x} cy={n.y} r={22} fill="var(--surface)" stroke={trailSet.has(n.key) ? 'var(--primary)' : 'var(--border)'} strokeWidth={trailSet.has(n.key) ? 2.5 : 1} opacity={trailSet.has(n.key) ? 0.9 : 0.5} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
                  {name(n.key)}
                </text>
              </g>
            );
          })}

          {links.map((l, i) => {
            const n = web.nodes[l.to]!;
            const label = name(l.to);
            const sel = selected === l.to;
            return (
              <g
                key={l.to}
                role="button"
                tabIndex={i === 0 ? 0 : -1}
                data-orbit=""
                data-key={l.to}
                aria-label={`${label}, ${FAMILY_LABEL[l.move.family]}`}
                aria-pressed={sel}
                className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[var(--foreground)]"
                onClick={tap(() => (sel ? onWalk(l.to) : onSelect(l.to)))}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onSelect(l.to)}
                onKeyDown={(e) => onOrbitKey(e, l.to)}
              >
                <circle cx={n.x} cy={n.y} r={sel ? 38 : 32} fill="var(--surface)" stroke={FAMILY_COLOR[l.move.family]} strokeWidth={sel ? 4 : 2.5} />
                <text x={n.x} y={n.y + 2} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--chord)">
                  {label}
                </text>
                <text x={n.x} y={n.y + 17} textAnchor="middle" fontSize={9.5} fill="var(--muted-foreground)" aria-hidden>
                  {FAMILY_LABEL[l.move.family]}
                </text>
              </g>
            );
          })}

          {web.opened ? (
            <g>
              <circle cx={focus.x} cy={focus.y} r={46} fill="var(--primary)" />
              <text x={focus.x} y={focus.y + 7} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--primary-foreground)">
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
    </div>
  );
};
