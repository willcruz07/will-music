import { useCallback, useEffect, useRef, useState } from 'react';
import { createSyncSession } from './syncSession.ts';

const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export const syncKeyAction = (e: { code: string; key: string; targetTag?: string }): 'mark' | 'back' | null => {
  if (e.targetTag && FIELD_TAGS.has(e.targetTag)) return null;
  if (e.code === 'Space') return 'mark';
  if (e.key === 'ArrowLeft') return 'back';
  return null;
};

/**
 * Tap-along sync session. The save callback is read through a ref, so re-renders (font size,
 * transpose, reloads) never end the session; it is saved on finish, after the last line, or on unmount.
 */
export const useSyncMode = ({ onSave, currentTime }: { onSave: (times: (number | null)[]) => void; currentTime: () => number }) => {
  const session = useRef<ReturnType<typeof createSyncSession> | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const [syncing, setSyncing] = useState(false);
  const [next, setNext] = useState(0);

  const finish = useCallback(() => {
    const s = session.current;
    session.current = null;
    setSyncing(false);
    if (s) saveRef.current(s.times);
  }, []);

  const start = useCallback((lineCount: number, initial: (number | null)[]) => {
    session.current = createSyncSession(lineCount, initial);
    setNext(0);
    setSyncing(true);
  }, []);

  const mark = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.mark(timeRef.current());
    setNext(s.next);
    if (s.done) finish();
  }, [finish]);

  const back = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.back();
    setNext(s.next);
  }, []);

  useEffect(() => () => finish(), [finish]);

  return { syncing, next, start, mark, back, finish };
};
