import { useEffect, useRef } from 'react';

type Props = {
  peaks: Float32Array | null;
  duration: number;
  time: number;
  loop: { a: number; b: number } | null;
  onSeek: (t: number) => void;
  /** Drag across the wave to choose a stretch to loop. */
  onSelect: (a: number, b: number) => void;
};

const css = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

/**
 * The whole song as a waveform: tap to jump, drag to mark a stretch (A–B) that then plays in a loop.
 * Drawn on a canvas so a 1200-column wave stays cheap to repaint while playing.
 */
export const Waveform = ({ peaks, duration, time, loop, onSeek, onSelect }: Props) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null);
  const preview = useRef<{ a: number; b: number } | null>(null);

  const draw = () => {
    const el = canvas.current;
    const ctx = el?.getContext?.('2d');
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = el.clientWidth;
    const height = el.clientHeight;
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const muted = css('--muted-foreground', '#93a3bc');
    const played = css('--primary', '#10b981');
    const glow = css('--glow', '#22d3ee');
    const region = preview.current ?? loop;
    if (region && duration) {
      ctx.fillStyle = `color-mix(in oklab, ${glow} 18%, transparent)`;
      ctx.fillRect((region.a / duration) * width, 0, ((region.b - region.a) / duration) * width, height);
    }
    if (peaks?.length) {
      const bar = width / peaks.length;
      const mid = height / 2;
      const progress = duration ? time / duration : 0;
      for (let i = 0; i < peaks.length; i++) {
        const h = Math.max(1, peaks[i]! * (height - 4));
        ctx.fillStyle = i / peaks.length <= progress ? played : muted;
        ctx.globalAlpha = i / peaks.length <= progress ? 1 : 0.55;
        ctx.fillRect(i * bar, mid - h / 2, Math.max(1, bar - 0.5), h);
      }
      ctx.globalAlpha = 1;
    }
    if (region && duration) {
      ctx.fillStyle = glow;
      for (const edge of [region.a, region.b]) ctx.fillRect((edge / duration) * width - 1, 0, 2, height);
    }
    if (duration) {
      ctx.fillStyle = css('--foreground', '#e8eef8');
      ctx.fillRect((time / duration) * width - 1, 0, 2, height);
    }
  };

  useEffect(draw);
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  const timeAt = (clientX: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return Math.min(duration, Math.max(0, ((clientX - rect.left) / Math.max(1, rect.width)) * duration));
  };

  return (
    <canvas
      ref={canvas}
      role="slider"
      tabIndex={0}
      aria-label="Onda da música: toque para ir até um ponto, arraste para marcar um trecho"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      className="h-20 w-full cursor-pointer touch-none rounded-lg bg-surface-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onSeek(Math.min(duration, time + 5));
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, time - 5));
      }}
      onPointerDown={(e) => {
        if (!duration) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, t: timeAt(e.clientX), moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (Math.abs(e.clientX - d.x) > 6) d.moved = true;
        if (d.moved) {
          const t = timeAt(e.clientX);
          preview.current = { a: Math.min(d.t, t), b: Math.max(d.t, t) };
          draw();
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        preview.current = null;
        if (!d) return;
        const t = timeAt(e.clientX);
        if (d.moved && Math.abs(t - d.t) >= 0.5) onSelect(Math.min(d.t, t), Math.max(d.t, t));
        else onSeek(t);
      }}
      onPointerCancel={() => {
        drag.current = null;
        preview.current = null;
        draw();
      }}
    />
  );
};
