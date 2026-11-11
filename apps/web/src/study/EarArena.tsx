import { useEffect, useRef, useState } from 'react';
import { Headphones, Flame, Trophy, Sparkles } from 'lucide-react';
import { EAR_KIND_NAMES, EAR_LEVELS, makeEarQuestion, makeEarRound, type EarLevel, type EarQuestion } from './earQuestions.ts';
import { PlayButton, useStudySynth } from './widgets.tsx';
import { rovingKeys } from '../lib/a11y.ts';

const BEST_KEY = 'wm-ear-arena-best-v1';
const readBest = (level: EarLevel): number => {
  try { const value: unknown = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')[level]; return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0; } catch { return 0; }
};
const chip = (active: boolean) => `min-h-11 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${active ? 'border-primary bg-primary/15 text-chord' : 'border-border bg-surface hover:border-primary/60'}`;
type Result = { question: EarQuestion; correct: boolean };

export const EarArena = ({ random = Math.random }: { random?: () => number }) => {
  const synth = useStudySynth();
  const [mode, setMode] = useState<'round' | 'notes'>('round');
  const [level, setLevel] = useState<EarLevel>('first');
  const [absolute, setAbsolute] = useState(false);
  const [questions, setQuestions] = useState<EarQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const [review, setReview] = useState(false);
  const [best, setBest] = useState(() => readBest('first'));
  const locked = useRef(false);
  const question = questions[index];
  useEffect(() => {
    const hide = () => { if (document.hidden) synth.stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const start = (retry?: EarQuestion[]) => {
    synth.stop(); locked.current = false;
    setQuestions(retry ?? (mode === 'notes' ? [makeEarQuestion('note', level, random, absolute)] : makeEarRound(level, random)));
    setIndex(0); setAnswer(null); setHeard(false); setResults([]); setAnsweredCount(0); setPoints(0); setStreak(0); setBestStreak(0); setFinished(false); setReview(!!retry); setBest(readBest(level));
  };
  const reset = () => { synth.stop(); setQuestions([]); setFinished(false); setResults([]); };
  const choose = (choice: string) => {
    if (locked.current || !question || !heard) return;
    locked.current = true;
    synth.stop(); setAnswer(choice);
    const correct = choice === question.correct;
    const nextStreak = correct ? streak + 1 : 0;
    setStreak(nextStreak); setBestStreak(value => Math.max(value, nextStreak));
    setPoints(value => value + (correct ? 100 + Math.min(nextStreak - 1, 5) * 10 : 0));
    setAnsweredCount(value => value + 1);
    setResults(value => [...value.slice(-99), { question, correct }]);
  };
  const next = () => {
    synth.stop(); locked.current = false; setAnswer(null); setHeard(false);
    if (mode === 'notes') { setQuestions([makeEarQuestion('note', level, random, absolute)]); setIndex(0); return; }
    if (index + 1 < questions.length) { setIndex(value => value + 1); return; }
    setFinished(true);
    if (!review && points > best) {
      setBest(points);
      try {
        const previous: unknown = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
        const records = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
        localStorage.setItem(BEST_KEY, JSON.stringify({ ...records, [level]: points }));
      } catch { /* The round remains usable without storage. */ }
    }
  };
  return <section className="mt-6 max-w-3xl">
    <header className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-surface to-surface p-5 sm:p-7">
      <div className="flex items-center gap-3"><Headphones className="size-8 shrink-0 text-primary" /><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ouça · reconheça · evolua</p><h2 className="text-2xl font-bold">Arena de Ouvido</h2></div></div>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">Desafios curtos, sem cronômetro. Ouvir novamente não tira pontos: treine a percepção no seu ritmo.</p>
    </header>
    {!question && <>
      <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo de treino" onKeyDown={rovingKeys}>{(['round', 'notes'] as const).map(value => <button key={value} type="button" role="radio" aria-checked={mode === value} className={chip(mode === value)} onClick={() => setMode(value)}><strong className="block">{value === 'round' ? 'Desafio musical' : 'Laboratório de notas'}</strong><span className="mt-1 block text-xs text-muted-foreground">{value === 'round' ? '10 questões variadas' : 'Prática livre em diferentes oitavas'}</span></button>)}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Nível" onKeyDown={rovingKeys}>{EAR_LEVELS.map(item => <button key={item.id} type="button" role="radio" aria-checked={level === item.id} className={chip(level === item.id)} onClick={() => { setLevel(item.id); setBest(readBest(item.id)); }}><Sparkles className="mb-2 size-4 text-primary" /><strong className="block">{item.name}</strong><span className="mt-2 block text-xs text-muted-foreground">{item.subtitle}</span></button>)}</div>
      {mode === 'notes' && <div className="mt-4 rounded-xl border border-border p-4"><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Referência de notas" onKeyDown={rovingKeys}>{[false, true].map(value => <button key={String(value)} type="button" role="radio" aria-checked={absolute === value} className={chip(absolute === value)} onClick={() => setAbsolute(value)}>{value ? 'Sem referência · opcional' : 'Com referência de Dó'}</button>)}</div><p className="mt-3 text-sm text-muted-foreground">As notas variam entre três oitavas. Comece com referência: reconhecer notas isoladas pelo nome é uma habilidade diferente e não é requisito para evoluir. No iniciante, usamos notas naturais; nos demais níveis, as 12 notas.</p></div>}
      <button type="button" onClick={() => start()} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">{mode === 'round' ? 'Começar rodada' : 'Começar treino livre'}</button>
      {mode === 'round' && <p className="mt-2 text-sm text-muted-foreground">Melhor pontuação neste nível: {best}. Recordes ficam somente neste aparelho.</p>}
    </>}
    {question && !finished && <div className="mt-5 rounded-3xl border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{mode === 'notes' ? `Treino livre · ${answeredCount} respostas` : `${review ? 'Revisão' : 'Rodada'} · ${index + 1} de ${questions.length}`}</span><span className="inline-flex items-center gap-2 font-semibold text-chord"><Trophy className="size-4" />{points} pts <Flame className="ml-2 size-4" />{streak}</span></div>
      {mode === 'round' && <div role="progressbar" aria-label="Progresso da rodada" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index + (answer !== null ? 1 : 0)} className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${100 * (index + (answer !== null ? 1 : 0)) / questions.length}%` }} /></div>}
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-chord">{EAR_KIND_NAMES[question.kind]}</p><h3 className="mt-2 text-xl font-semibold">{question.prompt}</h3><p className="mt-2 text-sm text-muted-foreground">{question.reference}</p>
      <div className="mt-5"><PlayButton active={synth.playing === 'ear-question'} onClick={() => { setHeard(true); synth.play('ear-question', question.events); }} label="desafio" /></div>
      {!heard && <p className="mt-2 text-xs text-muted-foreground">Ouça o desafio para liberar as respostas.</p>}
      <div className="mt-5 grid grid-cols-2 gap-2" role="group" aria-label="Alternativas">{question.options.map(option => <button key={option.id} type="button" disabled={!heard || answer !== null} onClick={() => choose(option.id)} className={`min-h-14 rounded-xl border p-3 text-left text-sm font-semibold disabled:cursor-default ${answer !== null && option.id === question.correct ? 'border-primary bg-primary/15 text-chord' : answer === option.id ? 'border-danger bg-danger/10' : 'border-border hover:bg-muted'} ${!heard ? 'opacity-50' : ''}`}>{option.label}{answer !== null && option.id === question.correct ? ' ✓' : ''}</button>)}</div>
      {answer !== null && <div className="mt-5 rounded-xl border border-border bg-background/50 p-4"><div role="status"><p className="font-semibold text-chord">{answer === question.correct ? 'Boa escuta!' : `Resposta: ${question.options.find(option => option.id === question.correct)!.label}`}</p><p className="mt-2 text-sm text-muted-foreground">{question.explanation}</p></div><div className="mt-3 flex flex-wrap gap-3">{question.options.filter(option => option.id === question.correct || option.id === answer).map(option => <div key={option.id}><p className="mb-1 text-xs text-muted-foreground">{option.id === question.correct ? 'Correta' : 'Sua escolha'} · {option.label}</p><PlayButton active={synth.playing === `ear-compare-${option.id}`} onClick={() => synth.play(`ear-compare-${option.id}`, option.events)} label={option.label} /></div>)}</div><button type="button" onClick={next} className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">{mode === 'round' && index === questions.length - 1 ? 'Ver resultado' : 'Próximo desafio'}</button></div>}
      <button type="button" className="mt-4 min-h-11 text-sm text-muted-foreground underline" onClick={reset}>Voltar aos modos</button>
    </div>}
    {finished && <div className="mt-5 rounded-3xl border border-primary/30 bg-surface p-5"><Trophy className="size-10 text-primary" /><h3 className="mt-3 text-2xl font-bold">Rodada concluída!</h3><p className="mt-2 text-lg text-chord">{points} pontos · {results.filter(result => result.correct).length}/{results.length} acertos</p><p className="mt-1 text-sm text-muted-foreground">Melhor sequência: {bestStreak}. Acerto: 100 pontos, mais bônus de sequência de até 50. Sem penalidade por repetir o áudio.</p><ul className="mt-4 space-y-2 text-sm">{Object.entries(EAR_KIND_NAMES).filter(([kind]) => results.some(result => result.question.kind === kind)).map(([kind, label]) => { const items = results.filter(result => result.question.kind === kind); return <li key={kind} className="flex justify-between rounded-lg bg-muted p-3"><span>{label}</span><strong>{items.filter(result => result.correct).length}/{items.length}</strong></li>; })}</ul><div className="mt-5 flex flex-wrap gap-2"><button type="button" className={chip(true)} onClick={() => start()}>Nova rodada</button>{results.some(result => !result.correct) && <button type="button" className={chip(false)} onClick={() => start(results.filter(result => !result.correct).map(result => result.question))}>Treinar meus erros</button>}<button type="button" className={chip(false)} onClick={reset}>Trocar modo ou nível</button></div></div>}
  </section>;
};
