import { Printer } from 'lucide-react';
import { useState, type RefObject } from 'react';
import { printChart } from '../lib/printChart.ts';
import { Button } from '../ui/Button.tsx';
export const PrintChartButton = ({ content, title, artist, disabled }: { content: RefObject<HTMLElement | null>; title: string; artist: string; disabled?: boolean }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <span className="inline-flex flex-col items-start gap-1"><Button variant="outline" disabled={disabled || busy} onClick={() => { if (!content.current) return; setBusy(true); setError(null); void printChart(content.current, title, artist).catch(e => setError(String(e instanceof Error ? e.message : e))).finally(() => setBusy(false)); }}><Printer className="size-4" />{busy ? 'Preparando impressão…' : 'Imprimir cifra'}</Button>{error && <span role="alert" className="text-xs text-danger">{error}</span>}</span>;
};
