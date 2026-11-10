import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ChordDiagram, type Instrument } from './ChordDiagram.tsx';
import { InstrumentToggle, readInstrument } from './ChordPanel.tsx';
import { IconButton } from '../ui/Button.tsx';

/** Only offers variations actually reported by the instrument's diagram provider. */
export const ChordVariations = ({ chord, compact = false }: { chord: string; compact?: boolean }) => {
  const [instrument, setInstrument] = useState(readInstrument);
  return <div className={`flex flex-col items-center overflow-auto ${compact ? 'gap-2 px-2 pb-1' : 'gap-4 px-4 pb-6'}`}>
    <InstrumentToggle value={instrument} onChange={setInstrument} />
    <Voicing key={`${chord}:${instrument}`} chord={chord} instrument={instrument} compact={compact} />
  </div>;
};

const Voicing = ({ chord, instrument, compact }: { chord: string; instrument: Instrument; compact: boolean }) => {
  const [variant, setVariant] = useState(0);
  const [count, setCount] = useState(0);
  return <>
    <ChordDiagram strict chord={chord} instrument={instrument} variant={variant} onVariants={setCount} size={compact ? 'sm' : 'lg'} />
    {count > 1 && <div className="flex items-center justify-center gap-4">
      <IconButton label="Formação anterior" onClick={() => setVariant(v => (v - 1 + count) % count)}><ChevronLeft className="size-5" /></IconButton>
      <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">{instrument === 'teclado' ? 'Inversão' : 'Formação'} {variant + 1} de {count}</span>
      <IconButton label="Próxima formação" onClick={() => setVariant(v => (v + 1) % count)}><ChevronRight className="size-5" /></IconButton>
    </div>}
  </>;
};
