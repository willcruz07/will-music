import { Printer } from 'lucide-react';
import { useState } from 'react';
import { printScore } from '../lib/printScore.ts';
import { Button } from '../ui/Button.tsx';

export const PrintScoreButton = ({ xml, title }: { xml: string; title: string }) => {
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <span className="inline-flex flex-col items-start gap-2">
    <Button variant="outline" disabled={preparing} onClick={() => { setPreparing(true); setError(null); void printScore(xml, title).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível imprimir.')).finally(() => setPreparing(false)); }}><Printer className="size-4" />{preparing ? 'Preparando impressão…' : 'Imprimir partitura'}</Button>
    {error && <span className="text-sm text-danger" role="alert">{error}</span>}
  </span>;
};
