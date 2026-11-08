import { ArrowLeft, ArrowRight, BookOpen, Check, CircleDot, Ear, Guitar, Library, ListMusic, Mic, Music2, Piano, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { ScrollStrip } from '../components/ScrollStrip.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { LessonBlocks, Rich } from '../study/blocks.tsx';
import { TRACKS, lessonById, readDone, readLast, setDone, setLast, trackLessons } from '../study/catalog.ts';
import { LEVELS, type Level, type Track } from '../study/types.ts';

const GROUPS: { id: Track['group']; about: string }[] = [
  { id: 'Teoria e harmonia', about: 'O que vale para qualquer instrumento: harmonia, ritmo, escalas e improviso.' },
  { id: 'Voz', about: 'Técnica vocal, do aquecimento aos drivers.' },
  { id: 'Instrumentos', about: 'A teoria aplicada no violão, no teclado e na bateria.' },
  { id: 'Estilos', about: 'Como cada gênero usa a harmonia e o ritmo.' },
];

const TOOLS: { tab: string; label: string; about: string; icon: typeof Guitar }[] = [
  { tab: 'acordes', label: 'Dicionário de acordes', about: 'Violão, teclado e cavaquinho', icon: Guitar },
  { tab: 'formacao', label: 'Formação', about: 'Intervalos, tríades e tétrades', icon: BookOpen },
  { tab: 'escalas', label: 'Campo harmônico', about: 'Escalas e acordes de cada tom', icon: Music2 },
  { tab: 'ciclo', label: 'Ciclo de quintas e quartas', about: 'Armaduras, relativos e vizinhos', icon: CircleDot },
  { tab: 'progressoes', label: 'Progressões', about: 'Em qualquer tom, para ouvir e tocar', icon: ListMusic },
  { tab: 'braco', label: 'Escalas no braço', about: 'Desenho, teclado e tablatura', icon: Piano },
  { tab: 'intervalos', label: 'Treino de ouvido', about: 'Reconheça intervalos', icon: Ear },
];

const levelLabel = (l: Level) => LEVELS.find((x) => x.id === l)!.label;

const ProgressBar = ({ done, total, label }: { done: number; total: number; label: string }) => (
  <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
  </div>
);

/** The study hub: tracks separated by subject, the practice tools and where you stopped. */
export const StudyHome = () => {
  const [params] = useSearchParams();
  const chord = params.get('acorde');
  const done = readDone();
  const last = readLast();
  const lastLesson = last ? lessonById(last) : undefined;
  if (chord) return <Navigate to={`/estudo/ferramentas?acorde=${encodeURIComponent(chord)}`} replace />;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Estudo</h1>
        <Link to="/microfone" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted">
          <Mic className="size-4" /> Afinador e microfone
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-muted-foreground">Trilhas do iniciante ao pro, com exemplos para ouvir em qualquer tom, e ferramentas para praticar.</p>

      {lastLesson && (
        <Link to={`/estudo/aula/${lastLesson.id}`} className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 hover:bg-primary/15">
          <BookOpen className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Continuar de onde parou</span>
            <span className="block truncate font-semibold">Continuar: {lastLesson.title}</span>
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      )}

      {GROUPS.map((g) => {
        const tracks = TRACKS.filter((t) => t.group === g.id);
        return (
          <section key={g.id} aria-labelledby={`grupo-${g.id}`} className="mt-8">
            <h2 id={`grupo-${g.id}`} className="text-xl font-semibold">
              {g.id}
            </h2>
            <p className="text-sm text-muted-foreground">{g.about}</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tracks.map((t) => {
                const lessons = trackLessons(t.id);
                const n = lessons.filter((l) => done.has(l.id)).length;
                return (
                  <li key={t.id}>
                    <Link to={`/estudo/trilha/${t.id}`} className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-surface p-4 hover:border-primary/60">
                      <span className="font-[family-name:var(--font-display)] text-lg font-semibold">{t.title}</span>
                      <span className="flex-1 text-sm text-muted-foreground">{t.about}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {n} de {lessons.length} aulas
                      </span>
                      <ProgressBar done={n} total={lessons.length} label={`Progresso em ${t.title}`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <Link to="/estudo/constelacao" className="mt-8 flex items-center gap-4 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-transparent p-4 hover:border-primary">
        <Sparkles className="size-8 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-[family-name:var(--font-display)] text-lg font-semibold">Constelação</span>
          <span className="block text-sm text-muted-foreground">Explore caminhos de rearmonização</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>

      <section aria-labelledby="ferramentas" className="mt-8">
        <h2 id="ferramentas" className="text-xl font-semibold">
          Ferramentas
        </h2>
        <p className="text-sm text-muted-foreground">Consulta rápida e treino, para usar junto das aulas.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TOOLS.map(({ tab, label, about, icon: Icon }) => (
            <li key={tab}>
              <Link to={`/estudo/ferramentas?aba=${tab}`} className="flex h-full items-start gap-2 rounded-xl border border-border p-3 hover:bg-muted">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{about}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
};

const NotFound = ({ what }: { what: string }) => (
  <section>
    <p className="text-lg font-semibold">{what} não encontrada.</p>
    <Link to="/estudo" className="mt-2 inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
      <ArrowLeft className="size-4" /> Voltar para o Estudo
    </Link>
  </section>
);

const BackLink = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
    <ArrowLeft className="size-4" /> {label}
  </Link>
);

/** One track: its lessons grouped by level, with a level filter and what was already studied. */
export const TrackPage = () => {
  const { id } = useParams();
  const track = TRACKS.find((t) => t.id === id);
  const [level, setLevel] = useState<Level | 'todos'>('todos');
  if (!track) return <NotFound what="Trilha" />;
  const done = readDone();
  const lessons = trackLessons(track.id);
  const n = lessons.filter((l) => done.has(l.id)).length;
  const levels = LEVELS.filter((l) => lessons.some((x) => x.level === l.id) && (level === 'todos' || level === l.id));
  const options: { id: Level | 'todos'; label: string }[] = [{ id: 'todos', label: 'Todos os níveis' }, ...LEVELS.filter((l) => lessons.some((x) => x.level === l.id))];

  return (
    <section>
      <BackLink to="/estudo" label="Estudo" />
      <p className="mt-2 text-xs text-muted-foreground">{track.group}</p>
      <h1 className="text-3xl font-bold tracking-tight">{track.title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{track.about}</p>
      <div className="mt-4 max-w-md">
        <p className="mb-1 text-sm tabular-nums">
          {n} de {lessons.length} aulas estudadas
        </p>
        <ProgressBar done={n} total={lessons.length} label={`Progresso em ${track.title}`} />
      </div>
      <ScrollStrip className="mt-5" role="radiogroup" label="Nível" selected={level} onKeyDown={rovingKeys} innerClassName="gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={level === o.id}
            onClick={() => setLevel(o.id)}
            className={`min-h-10 scroll-mx-4 whitespace-nowrap rounded-full px-4 text-sm ${level === o.id ? 'bg-primary font-semibold text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        ))}
      </ScrollStrip>
      {levels.map((l) => (
        <section key={l.id} aria-labelledby={`nivel-${l.id}`} className="mt-6">
          <h2 id={`nivel-${l.id}`} className="text-lg font-semibold">
            {l.label}
          </h2>
          <p className="text-sm text-muted-foreground">{l.about}</p>
          <ol className="mt-3 grid gap-2">
            {lessons
              .filter((x) => x.level === l.id)
              .map((x) => (
                <li key={x.id}>
                  <Link to={`/estudo/aula/${x.id}`} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 hover:border-primary/60">
                    <span
                      aria-label={done.has(x.id) ? 'Estudada' : undefined}
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${done.has(x.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                    >
                      {done.has(x.id) && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{x.title}</span>
                      <span className="block text-sm text-muted-foreground">{x.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </section>
  );
};

/** One lesson: its blocks, a "studied" mark and the way to the previous and next lessons of the track. */
export const LessonPage = () => {
  const { id = '' } = useParams();
  const lesson = lessonById(id);
  const [studied, setStudied] = useState(() => readDone().has(id));
  useEffect(() => {
    if (!lesson) return;
    setLast(lesson.id);
    setStudied(readDone().has(lesson.id));
    window.scrollTo?.({ top: 0 });
  }, [lesson]);
  if (!lesson) return <NotFound what="Aula" />;
  const track = TRACKS.find((t) => t.id === lesson.track)!;
  const lessons = trackLessons(track.id);
  const i = lessons.findIndex((l) => l.id === lesson.id);
  const prev = lessons[i - 1];
  const next = lessons[i + 1];
  const toggle = () => {
    setDone(lesson.id, !studied);
    setStudied(!studied);
  };

  return (
    <article className="mx-auto max-w-3xl">
      <BackLink to={`/estudo/trilha/${track.id}`} label={track.title} />
      <p className="mt-2 text-xs text-muted-foreground">
        {track.title} · {levelLabel(lesson.level)} · aula {i + 1} de {lessons.length}
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight">{lesson.title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        <Rich text={lesson.summary} />
      </p>
      <div className="mt-4 leading-relaxed">
        <LessonBlocks key={lesson.id} blocks={lesson.blocks} lessonId={lesson.id} />
      </div>
      <div className="mt-8 border-t border-border pt-5">
        <button
          type="button"
          aria-pressed={studied}
          onClick={toggle}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold ${studied ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}
        >
          <Check className="size-4" /> {studied ? 'Estudada' : 'Marcar como estudada'}
        </button>
        <nav aria-label="Outras aulas" className="mt-5 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <Link to={`/estudo/aula/${prev.id}`} className="rounded-xl border border-border p-3 hover:bg-muted">
              <span className="block text-xs text-muted-foreground">Anterior</span>
              <span className="block font-semibold">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link to={`/estudo/aula/${next.id}`} className="rounded-xl border border-border p-3 text-right hover:bg-muted">
              <span className="block text-xs text-muted-foreground">Próxima</span>
              <span className="block font-semibold">{next.title}</span>
            </Link>
          ) : (
            <Link to="/estudo" className="inline-flex items-center justify-end gap-2 rounded-xl border border-border p-3 text-right hover:bg-muted">
              <Library className="size-4" /> Fim da trilha: escolher outra
            </Link>
          )}
        </nav>
      </div>
    </article>
  );
};
