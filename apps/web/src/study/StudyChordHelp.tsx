import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChordHelp } from '../components/ChordHelp.tsx';

const ChordContext = createContext<(chord: string, anchor?: DOMRect) => void>(() => {});
export const useStudyChord = () => useContext(ChordContext);

/** One shared popover keeps all tools on their current tab, without clipping in scroll containers. */
export const StudyChordProvider = ({ children }: { children: ReactNode }) => {
  const [help, setHelp] = useState<{ chord: string; anchor?: DOMRect } | null>(null);
  return <ChordContext.Provider value={(chord, anchor) => setHelp({ chord, anchor: anchor ?? document.activeElement?.getBoundingClientRect() })}>
    {children}
    {help && createPortal(<ChordHelp key={help.chord} chord={help.chord} anchor={help.anchor} onClose={() => setHelp(null)} strict showStudyLink={false} />, document.body)}
  </ChordContext.Provider>;
};

export const StudyChordButton = ({ chord, children, className = '' }: { chord: string; children?: ReactNode; className?: string }) => {
  const open = useStudyChord();
  return <button type="button" aria-label={`Como tocar ${chord}`} onClick={event => open(chord, event.currentTarget.getBoundingClientRect())} className={className}>{children ?? chord}</button>;
};
