import { ArrowUpRight, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet.tsx";
import { AboutStory } from "./AboutStory.tsx";
import { AuthorCarousel } from "./AuthorCarousel.tsx";
import { alertDialog } from "../ui/Dialog.tsx";

export const AUTHOR = {
  name: "Will Cruz",
  fullName: "Wellen Cruz",
  whatsapp: "5521981314531",
  whatsappLabel: "(21) 98131-4531",
  instagram: "willcruz_k07",
  pix: "21981314531",
};

const PHOTO = `${import.meta.env.BASE_URL}will.jpeg`;
const LOGO = `${import.meta.env.BASE_URL}logo.webp`;

const SEEN_KEY = "wm-about-seen";

/** True the first time this device opens the app (and records it), so the presentation shows once. */
const firstVisit = (): boolean => {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false;
    localStorage.setItem(SEEN_KEY, "1");
    return true;
  } catch {
    return false;
  }
};

/**
 * "Sobre" opener: a quiet text link at the end of the library, or a row in Ajustes. Both open the same sheet.
 * With `autoOpenOnce`, the sheet also opens by itself on the first visit, as the app's introduction.
 */
export const AboutButton = ({
  variant = "link",
  autoOpenOnce = false,
}: {
  variant?: "link" | "row";
  autoOpenOnce?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const welcome = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
    // The first-visit presentation ends with a thank-you (opening "Sobre" later does not).
    if (welcome.current) {
      welcome.current = false;
      void alertDialog(
        "Obrigado por conhecer o will-music. Espero que este projeto faça parte da sua caminhada de estudo, criação e música.",
        { title: "Obrigado pela visita!" },
      );
    }
  };

  useEffect(() => {
    if (autoOpenOnce && firstVisit()) {
      welcome.current = true;
      setOpen(true);
    }
  }, [autoOpenOnce]);

  return (
    <>
      {variant === "link" ? (
        <div className="mt-10">
          <button
            ref={trigger}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className="about-invitation group grid w-full grid-cols-[20%_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border text-left transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="relative block self-stretch"><AuthorCarousel decorative paused={open} /></span>
            <span className="block min-w-0 p-4 sm:p-6">
              <span className="block text-xs font-semibold uppercase tracking-wide text-chord">Música e tecnologia</span>
              <span className="mt-2 block break-words text-base font-semibold leading-snug sm:text-xl">Conheça o will-music e quem o criou</span>
              <span className="mt-2 block break-words text-sm leading-relaxed text-muted-foreground">A trajetória de Will Cruz e a história por trás do projeto.</span>
              <span className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-chord"><span>Conheça minha história</span><ArrowUpRight className="size-4 shrink-0" aria-hidden /></span>
            </span>
          </button>
        </div>
      ) : (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:border-primary/60 hover:bg-surface-2"
        >
          <img
            src={PHOTO}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover object-[45%_20%]"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Sobre o will-music</span>
            <span className="block truncate text-sm text-muted-foreground">
              Música, tecnologia e a história de Will Cruz
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      )}
      {open && <AboutSheet onClose={close} />}
    </>
  );
};

export const AboutSheet = ({ onClose }: { onClose: () => void }) => {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const copyPix = async () => {
    try { await navigator.clipboard.writeText(AUTHOR.pix); setCopied("ok"); }
    catch { setCopied("fail"); }
  };
  return <BottomSheet title={`Sobre · ${AUTHOR.name}`} hideTitle onClose={onClose} size="wide">
    {() => <AboutStory author={AUTHOR} photo={PHOTO} logo={LOGO} copied={copied} onCopy={() => void copyPix()} />}
  </BottomSheet>;
};
