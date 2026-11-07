import type { ChordSegment, KeyMatch, KeyResult } from '@will-music/engine';
import type { Reference } from './references.ts';

export type SongResult = {
  reference: Reference;
  durationSec: number;
  processingSec: number;
  key: KeyResult;
  keyMatch: KeyMatch;
  score: { lcs: number; recall: number; precision: number };
  segments: ChordSegment[];
  simplified: string[];
};

export const GATE = 0.7;

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const KEY_MATCH: Record<KeyMatch, string> = { exact: 'certo', relative: 'relativo', fifth: 'quinta', wrong: 'errado' };
const modePt = (mode: string): string => (mode === 'major' ? 'maior' : 'menor');

export const renderReport = (results: SongResult[], date: string): string => {
  const mean = results.length ? results.reduce((s, r) => s + r.score.recall, 0) / results.length : 0;
  const drafts = results.some((r) => r.reference.status === 'draft');
  const verdict = mean >= GATE
    ? '**Seguir** para o Plano 2.'
    : '**Abaixo da meta**: testar Essentia.js; a V1 segue com a cifra como rascunho editável.';
  const lines = [
    '# Fase 0 — relatório de qualidade dos acordes',
    '',
    `Gerado em ${date}. Modelos: ChordMini (acordes) e S-KEY (tom), rodando em CPU com o motor \`@will-music/engine\`.`,
    '',
    `**Cobertura média: ${pct(mean)}** (meta ${pct(GATE)}). ${verdict}`,
    ...(drafts ? ['', '> Atenção: há referências em **rascunho**, ainda não confirmadas pelo músico.'] : []),
    '',
    '| Música | Tom ref. | Tom previsto | Tom | Cobertura | Ruído | Acordes ref/prev | Duração | Processamento |',
    '|---|---|---|---|---|---|---|---|---|',
    ...results.map((r) => {
      const ref = r.reference;
      const name = `${ref.title} — ${ref.artist}${ref.status === 'draft' ? ' (rascunho)' : ''}`;
      return `| ${name} | ${ref.key.root} ${modePt(ref.key.mode)} | ${r.key.root} ${modePt(r.key.mode)} | ${KEY_MATCH[r.keyMatch]} | ${pct(r.score.recall)} | ${pct(1 - r.score.precision)} | ${ref.sequence.length}/${r.simplified.length} | ${mmss(r.durationSec)} | ${r.processingSec.toFixed(1)} s |`;
    }),
    '',
    'Cobertura = parte da sequência de referência reencontrada na ordem (LCS). Ruído = acordes previstos que não estão na referência. Comparação por fundamental + maior/menor.',
  ];
  for (const r of results) {
    lines.push('', `## ${r.reference.title}`, '', `**Referência:** ${r.reference.sequence.join(' ')}`, '', `**Previsto:** ${r.simplified.join(' ')}`);
  }
  return `${lines.join('\n')}\n`;
};
