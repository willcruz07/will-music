import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const AUTHOR_PHOTOS = ['will.jpeg', 'will-1.jpg', 'will-2.jpg', 'will-3.jpg', 'will-4.jpg', 'will-5.jpg'].map(file => `${import.meta.env.BASE_URL}${file}`);

/** Decorative rotation in the opener; full keyboard/touch controls in the presentation. */
export const AuthorCarousel = ({ decorative = false, paused = false }: { decorative?: boolean; paused?: boolean }) => {
  const [index, setIndex] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const box = useRef<HTMLSpanElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const move = (delta: number) => setIndex(current => (current + delta + AUTHOR_PHOTOS.length) % AUTHOR_PHOTOS.length);
  const choose = (next: number) => { setIndex(next); setManualPause(true); };
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    const motion = () => setReduced(!!media?.matches);
    media?.addEventListener?.('change', motion);
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting)) : undefined;
    if (box.current) observer?.observe(box.current);
    return () => { document.removeEventListener('visibilitychange', visibility); media?.removeEventListener?.('change', motion); observer?.disconnect(); };
  }, []);
  const rotating = !paused && !manualPause && !hovered && !focused && visible && !hidden && !reduced;
  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => move(1), 6000);
    return () => clearInterval(timer);
  }, [rotating]);
  return <span ref={box} className={`block overflow-hidden ${decorative ? 'absolute inset-0 h-full w-full' : 'relative aspect-[4/3] w-full md:aspect-[4/5]'}`}
    role={decorative ? undefined : 'group'} aria-label={decorative ? undefined : 'Fotos de Will Cruz'} aria-roledescription={decorative ? undefined : 'carrossel'} aria-hidden={decorative || undefined}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); }}
    onKeyDown={e => { if (!decorative && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); move(e.key === 'ArrowLeft' ? -1 : 1); setManualPause(true); } }}
    onPointerDown={e => { if (!decorative && !(e.target as Element).closest('button')) touch.current = { x: e.clientX, y: e.clientY }; }}
    onPointerCancel={() => { touch.current = null; }} onPointerUp={e => { const start = touch.current; touch.current = null; if (start && Math.abs(e.clientX - start.x) > 40 && Math.abs(e.clientX - start.x) > Math.abs(e.clientY - start.y)) { move(e.clientX < start.x ? 1 : -1); setManualPause(true); } }}>
    {AUTHOR_PHOTOS.map((photo, i) => <img key={photo} src={photo} alt={decorative || i !== index ? '' : `Will Cruz — foto ${i + 1}`} aria-hidden={i !== index || decorative || undefined} decoding="async" loading={i === 0 ? 'eager' : 'lazy'} className={`absolute inset-0 size-full object-cover object-[45%_25%] transition-opacity duration-700 motion-reduce:transition-none ${i === index ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />)}
    {!decorative && <>
      <button type="button" aria-label={manualPause ? 'Retomar fotos' : 'Pausar fotos'} aria-pressed={manualPause} onClick={() => setManualPause(value => !value)} className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-sm">{manualPause ? <Play className="size-4" /> : <Pause className="size-4" />}</button>
      <button type="button" aria-label="Foto anterior" onClick={() => { move(-1); setManualPause(true); }} className="absolute left-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"><ChevronLeft className="size-5" /></button>
      <button type="button" aria-label="Próxima foto" onClick={() => { move(1); setManualPause(true); }} className="absolute right-2 top-1/2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"><ChevronRight className="size-5" /></button>
      <span className="absolute inset-x-0 bottom-1 z-20 flex items-center justify-center" aria-label="Escolher foto">{AUTHOR_PHOTOS.map((_, i) => <button key={i} type="button" aria-label={`Mostrar foto ${i + 1}`} aria-current={i === index ? 'true' : undefined} onClick={() => choose(i)} className="flex h-8 w-7 items-center justify-center"><span className={`h-1.5 rounded-full transition-[width] motion-reduce:transition-none ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} /></button>)}</span>
    </>}
  </span>;
};
