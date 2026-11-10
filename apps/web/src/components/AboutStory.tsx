import { AudioLines, Camera, Check, Code2, Copy, HandHeart, MessageCircle, Mic2, Piano, Sparkles } from 'lucide-react';
import type { AUTHOR } from './About.tsx';
import { AuthorCarousel } from './AuthorCarousel.tsx';

export const AboutStory = ({ author, photo, logo, copied, onCopy }: {
  author: typeof AUTHOR; photo: string; logo: string; copied: 'ok' | 'fail' | null; onCopy: () => void;
}) => <div className="overflow-y-auto overscroll-contain px-4 pb-6 md:px-8 md:pb-8">
  <div className="grid items-start gap-6 md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] md:gap-8">
    <aside className="md:sticky md:top-0">
      <figure className="relative overflow-hidden rounded-2xl">
        <AuthorCarousel />
        <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-xs text-white backdrop-blur-md">Criador do will-music</span>
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pb-9 pt-20 text-white">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold">{author.name}</p>
          <p className="mt-1 text-sm text-white/85">{author.fullName}</p>
          <p className="mt-3 text-xs leading-relaxed text-white/80">Músico, produtor musical e desenvolvedor de software.</p>
        </figcaption>
      </figure>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5"><Piano className="size-3.5 text-chord" aria-hidden />Teclado e piano</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5"><Mic2 className="size-3.5 text-chord" aria-hidden />Voz e produção</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5"><Code2 className="size-3.5 text-chord" aria-hidden />Mais de 10 anos em tecnologia</span>
      </div>
    </aside>
    <div className="min-w-0">
      <span className="text-xs font-semibold uppercase tracking-widest text-chord">A pessoa por trás do projeto</span>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug md:text-3xl">Música na essência.<br /><span className="text-chord">Tecnologia na construção.</span></h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        <p className="text-base font-semibold text-foreground">Prazer, sou {author.name}.</p>
        <p>Também conhecido como {author.fullName}, sou músico, tecladista, cantor, produtor musical e desenvolvedor de software. Minha trajetória sempre foi marcada por duas grandes paixões: a música e a tecnologia.</p>
        <p>A música faz parte da minha vida. Ao longo dessa caminhada, explorei diversos instrumentos, mas foi no <strong className="font-semibold text-foreground">teclado e no piano</strong> que encontrei minha principal identidade musical. Minha relação com a música vai além de tocar: passa pelo estudo da harmonia, pelos arranjos, pela produção e pela descoberta de novas possibilidades.</p>
        <p>Em paralelo, construí uma carreira de <strong className="font-semibold text-foreground">mais de uma década na tecnologia</strong>, desenvolvendo aplicações web, mobile e soluções digitais. Essa experiência reforçou minha visão de que a tecnologia faz mais sentido quando simplifica a rotina e aproxima as pessoas daquilo que amam.</p>
      </div>
      <section className="mt-7 border-t border-border pt-6">
        <h3 className="text-lg font-semibold">Dois caminhos. Um propósito.</h3>
        <div className="mt-3 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
          <p>Foi da união desses dois mundos que nasceu o <strong className="font-semibold text-foreground">will-music</strong>. Meu objetivo é construir uma plataforma que reúna conhecimento, criatividade e tecnologia em ferramentas que façam sentido na rotina de quem vive a música.</p>
          <p>O projeto carrega minha identidade como músico e desenvolvedor, mas tem um propósito que vai além da minha própria experiência: ajudar outros músicos a <strong className="font-semibold text-foreground">estudar, evoluir, criar e explorar seu potencial musical</strong>.</p>
          <p>Acredito que a música é uma linguagem universal e que a tecnologia pode torná-la mais acessível, intuitiva e inspiradora.</p>
        </div>
        <blockquote className="mt-5 rounded-r-xl border-l-2 border-primary bg-primary/5 px-4 py-3 text-base font-medium leading-relaxed text-chord">“O encontro entre a sensibilidade de quem faz música e a criatividade de quem desenvolve tecnologia.”<cite className="mt-2 block text-xs not-italic text-muted-foreground">Will Cruz · propósito do will-music</cite></blockquote>
      </section>
    </div>
  </div>

  <section className="about-project mt-8 overflow-hidden rounded-2xl border border-border p-5 sm:p-6">
    <div className="flex flex-wrap items-center gap-4"><img src={logo} alt="Will-Music — sua música, sem limites" className="h-20 w-28 rounded-xl bg-black object-cover object-[50%_47%]" /><div className="min-w-0 flex-1"><span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-chord"><Sparkles className="size-3.5" aria-hidden />O projeto</span><h3 className="mt-2 text-xl font-semibold">Seu estudo musical, com mais possibilidades.</h3></div></div>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">O will-music é gratuito e de código aberto. Um espaço para explorar suas músicas, organizar cifras e transformar a escuta em prática, com recursos pensados para o estudo musical.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <div><h4 className="flex items-center gap-2 text-sm font-semibold"><AudioLines className="size-4 text-chord" aria-hidden />Estúdio</h4><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Ouça com atenção, explore faixas separadas e descubra letras e acordes.</p></div>
      <div><h4 className="text-sm font-semibold">Cifras</h4><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Revise a harmonia, escolha suas formações e organize o repertório em listas.</p></div>
      <div><h4 className="text-sm font-semibold">Partituras</h4><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Visualize as partes geradas, salve seu estudo e leve os resultados para outros editores.</p></div>
    </div>
    <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Seus áudios são processados no próprio aparelho. Os recursos dependem do navegador e dos modelos baixados; as transcrições podem ser revisadas e ajustadas por você.</p>
  </section>

  <section className="mt-8">
    <h3 className="text-lg font-semibold">Vamos conversar?</h3>
    <p className="mt-2 text-sm text-muted-foreground">Uma sugestão para o projeto, uma dúvida ou uma conversa sobre música. Estes são meus canais.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <a href={`https://wa.me/${author.whatsapp}`} target="_blank" rel="noopener noreferrer" className="group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-primary/60"><MessageCircle className="size-5 shrink-0 text-chord" aria-hidden /><span className="min-w-0"><span className="block text-sm font-semibold">WhatsApp</span><span className="mt-1 block text-xs text-muted-foreground">{author.whatsappLabel}</span></span></a>
      <a href={`https://www.instagram.com/${author.instagram}/`} target="_blank" rel="noopener noreferrer" className="group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-primary/60"><Camera className="size-5 shrink-0 text-chord" aria-hidden /><span className="min-w-0"><span className="block text-sm font-semibold">Instagram</span><span className="mt-1 block truncate text-xs text-muted-foreground">@{author.instagram}</span></span></a>
    </div>
  </section>

  <section className="mt-7 rounded-2xl border border-primary/30 bg-primary/5 p-5">
    <div className="flex items-start gap-3"><HandHeart className="mt-1 size-5 shrink-0 text-primary" aria-hidden /><div><h3 className="font-semibold">Faça parte da evolução do projeto.</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Se o will-music faz parte dos seus estudos e você quiser contribuir, um apoio de qualquer valor ajuda a manter o projeto e desenvolver novas possibilidades.</p></div></div>
    <button type="button" onClick={onCopy} className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-left font-semibold text-primary-foreground hover:brightness-105">{copied === 'ok' ? <Check className="size-5 shrink-0" aria-hidden /> : <Copy className="size-5 shrink-0" aria-hidden />}<span className="min-w-0"><span className="block text-sm">{copied === 'ok' ? 'Chave Pix copiada!' : 'Copiar chave Pix'}</span><span className="mt-1 block text-xs font-normal opacity-85">Celular: {author.pix}</span></span></button>
    <p role="status" className="mt-2 min-h-5 text-xs text-muted-foreground">{copied === 'ok' && 'Chave copiada. Obrigado por apoiar o will-music.'}{copied === 'fail' && `Não foi possível copiar automaticamente. A chave é: ${author.pix}`}</p>
  </section>
</div>;
