/**
 * The floating "you have no models" notice: hidden for a while ("Me lembre mais tarde") or for good
 * ("Não me exiba mais"), remembered on this device.
 */
const KEY = 'wm-models-reminder';
export const SNOOZE_MS = 24 * 60 * 60 * 1000;

type State = { never?: boolean; until?: number };

const read = (): State => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as State;
  } catch {
    return {};
  }
};
const write = (state: State) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage blocked: the notice may come back sooner
  }
};

/** True when the notice may show now. */
export const reminderDue = (now = Date.now()): boolean => {
  const s = read();
  return !s.never && (s.until ?? 0) <= now;
};

/** Milliseconds until a snoozed notice is due again (0 when due, null when hidden for good). */
export const reminderWait = (now = Date.now()): number | null => {
  const s = read();
  if (s.never) return null;
  return Math.max(0, (s.until ?? 0) - now);
};

export const snoozeReminder = (now = Date.now()) => write({ until: now + SNOOZE_MS });
export const neverRemind = () => write({ never: true });

/** Fired after models are downloaded or removed, so the notice and the setup sheet check again. */
export const MODELS_CHANGED = 'wm-models-changed';
export const notifyModelsChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MODELS_CHANGED));
};
