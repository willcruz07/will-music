import type { SeparationProgress } from './stems.ts';

const mb = (bytes: number) => Math.round(bytes / 1e6);

const remaining = (ms: number): string => {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return 'menos de 1 min restante';
  const min = Math.round(s / 60);
  return `cerca de ${min} min restante${min > 1 ? 's' : ''}`;
};

export type SeparationView = { label: string; detail?: string; fraction?: number };

/**
 * Turns the separation worker's messages into what the musician reads: the model download in MB (with speed), the
 * moment the model goes to the graphics card, then "Bloco N de M" with an estimate of the time left. It keeps the
 * timestamps it needs, so create one per separation.
 */
export const createSeparationReporter = (now: () => number = () => performance.now()) => {
  let downloadStart: { at: number; done: number } | null = null;
  let firstBlockAt: number | null = null;
  return (p: SeparationProgress): SeparationView => {
    if (p.stage === 'models') {
      // A cached model reports itself complete at once: nothing to download, only the check.
      if (p.total > 0 && p.done >= p.total) return { label: 'Modelo de faixas pronto', detail: 'Levando o modelo para a placa de vídeo…' };
      const t = now();
      if (!downloadStart) downloadStart = { at: t, done: p.done };
      const seconds = (t - downloadStart.at) / 1000;
      const speed = seconds > 1 ? (p.done - downloadStart.done) / seconds : 0;
      const parts = [`${mb(p.done)} de ${mb(p.total)} MB`];
      if (speed > 0) {
        parts.push(`${(speed / 1e6).toFixed(1).replace('.', ',')} MB/s`);
        parts.push(remaining(((p.total - p.done) / speed) * 1000));
      }
      return { label: 'Baixando o modelo de faixas (só na primeira vez)', detail: parts.join(' · '), fraction: p.total ? p.done / p.total : undefined };
    }
    if (p.done <= 0) return { label: 'Separando faixas da música…', detail: `Preparando ${p.total} blocos na placa de vídeo…` };
    const t = now();
    if (p.done === 1 || firstBlockAt === null) firstBlockAt = t;
    const perBlock = p.done > 1 ? (t - firstBlockAt) / (p.done - 1) : 0;
    const left = p.total - p.done;
    const detail = [`Bloco ${p.done} de ${p.total}`, perBlock > 0 && left > 0 ? remaining(perBlock * left) : left === 0 ? 'finalizando as faixas' : ''].filter(Boolean).join(' · ');
    return { label: 'Separando faixas da música…', detail, fraction: p.done / p.total };
  };
};
