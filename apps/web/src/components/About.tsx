import { Check, ChevronRight, Copy, HandHeart, MessageCircle, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet.tsx';

export const AUTHOR = {
  name: 'Will Cruz',
  fullName: 'Wellen Cruz',
  whatsapp: '5521981314531',
  whatsappLabel: '(21) 98131-4531',
  instagram: 'willcruz_k07',
  pix: '21981314531',
};

const PHOTO = `${import.meta.env.BASE_URL}will.jpeg`;

/** Instagram has no icon in lucide (no brand marks), so a plain camera-style glyph stands in. */
const InstagramGlyph = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

/** "Sobre" opener: a card at the end of the library, or a row in Ajustes. Both open the same sheet. */
export const AboutButton = ({ variant = 'card' }: { variant?: 'card' | 'row' }) => {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <>
      {variant === 'card' ? (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="group mt-10 flex w-full max-w-xl items-center gap-4 rounded-2xl border border-border bg-surface p-3 pr-4 text-left transition-colors hover:border-primary/60 hover:bg-surface-2"
        >
          <img src={PHOTO} alt="" className="size-14 shrink-0 rounded-xl object-cover object-[45%_20%]" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Feito com 🎵 por</span>
            <span className="block truncate text-base font-semibold">{AUTHOR.name} · conheça o projeto</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      ) : (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:border-primary/60 hover:bg-surface-2"
        >
          <img src={PHOTO} alt="" className="size-10 shrink-0 rounded-full object-cover object-[45%_20%]" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Sobre o will-music</span>
            <span className="block truncate text-sm text-muted-foreground">Quem fez, contato e como apoiar</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}
      {open && <AboutSheet onClose={close} />}
    </>
  );
};

export const AboutSheet = ({ onClose }: { onClose: () => void }) => {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(AUTHOR.pix);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  return (
    <BottomSheet title={`Sobre · ${AUTHOR.name}`} hideTitle onClose={onClose} panelClassName="max-h-[92dvh]">
      {() => (
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">
          <figure className="relative overflow-hidden rounded-2xl">
            <img src={PHOTO} alt={`${AUTHOR.name} tocando teclado e cantando ao vivo`} className="aspect-[4/3] w-full object-cover object-[45%_25%]" />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-4 pt-16 text-white">
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold">{AUTHOR.name}</p>
              <p className="text-sm text-white/85">{AUTHOR.fullName} · músico desde sempre 🎹🎤</p>
            </figcaption>
          </figure>

          <div className="mt-5 space-y-3 text-[15px] leading-relaxed">
            <p className="text-lg font-semibold">Prazer, eu sou o Will! 👋</p>
            <p>
              Música é a minha vida desde que me entendo por gente. Juntei tudo o que aprendi e desenvolvi na minha caminhada — no palco, nos ensaios e
              em muitas horas de estudo — e coloquei aqui dentro pra te ajudar a <strong>evoluir de verdade</strong>.
            </p>
            <p>
              Do primeiro acorde até o nível <strong>pro</strong> 🚀, com conhecimento de sobra e aqueles <strong>segredinhos</strong> que fazem toda a
              diferença. Bora tocar junto?
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-surface-2 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-chord" aria-hidden /> Sobre o will-music
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Gratuito e de código aberto. Cifras, acordes, separação de faixas, partituras, afinador e trilhas de estudo — tudo roda no seu aparelho, com a
              inteligência artificial no próprio navegador, e funciona até sem internet.
            </p>
          </div>

          <p className="mt-6 text-sm font-semibold text-muted-foreground">Bora trocar uma ideia? 💬</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <a
              href={`https://wa.me/${AUTHOR.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center gap-3 rounded-xl bg-[#25D366] px-4 py-2.5 font-semibold text-[#06301a] hover:brightness-105"
            >
              <MessageCircle className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="block">WhatsApp</span>
                <span className="block text-xs font-normal opacity-80">{AUTHOR.whatsappLabel}</span>
              </span>
            </a>
            <a
              href={`https://www.instagram.com/${AUTHOR.instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center gap-3 rounded-xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] px-4 py-2.5 font-semibold text-white hover:brightness-110"
            >
              <InstagramGlyph className="size-5 shrink-0" />
              <span className="min-w-0">
                <span className="block">Instagram</span>
                <span className="block truncate text-xs font-normal opacity-90">@{AUTHOR.instagram}</span>
              </span>
            </a>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-4">
            <p className="flex items-center gap-2 font-semibold">
              <HandHeart className="size-5 text-primary" aria-hidden /> Curtiu o projeto? Apoie! 🥰
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              O will-music é feito com carinho e vai continuar gratuito. Se ele te ajudou, uma doação de qualquer valor no Pix ajuda a manter e trazer
              novidades.
            </p>
            <button
              type="button"
              onClick={() => void copyPix()}
              className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl bg-primary px-4 py-2.5 text-left font-semibold text-primary-foreground hover:brightness-105"
            >
              {copied === 'ok' ? <Check className="size-5 shrink-0" aria-hidden /> : <Copy className="size-5 shrink-0" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block">{copied === 'ok' ? 'Chave Pix copiada!' : 'Copiar chave Pix'}</span>
                <span className="block text-xs font-normal opacity-85">Celular: {AUTHOR.pix}</span>
              </span>
            </button>
            <p role="status" className="mt-2 min-h-5 text-xs text-muted-foreground">
              {copied === 'ok' && 'Agora é só colar no app do seu banco. Valeu demais! 💚'}
              {copied === 'fail' && `Não deu pra copiar automaticamente. A chave é: ${AUTHOR.pix}`}
            </p>
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
