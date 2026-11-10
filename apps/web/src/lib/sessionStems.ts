import type { StemsRecord } from './db.ts';

type Session = { record?: StemsRecord; users: number; listeners: Set<() => void> };
const sessions = new Map<string, Session>();

/** Jobs and mounted players share compressed tracks; the last owner releases the audio. */
export const retainSessionStems = (songId: string, listener?: () => void): (() => void) => {
  let session = sessions.get(songId);
  if (!session) { session = { users: 0, listeners: new Set() }; sessions.set(songId, session); }
  session.users++;
  if (listener) session.listeners.add(listener);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (listener) session.listeners.delete(listener);
    if (--session.users === 0) sessions.delete(songId);
  };
};

export const getSessionStems = (songId: string): StemsRecord | undefined => sessions.get(songId)?.record;
export const setSessionStems = (songId: string, record?: StemsRecord): void => {
  const session = sessions.get(songId);
  if (!session) return;
  session.record = record;
  for (const listener of session.listeners) listener();
};
