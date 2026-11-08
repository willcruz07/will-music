import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'wm-theme';
const listeners = new Set<(pref: ThemePref) => void>();

export const getThemePref = (): ThemePref => {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export const isDark = (pref = getThemePref()): boolean => pref === 'dark' || (pref === 'system' && systemDark());

/** Applies the saved preference to <html> (the stage uses this to restore the theme on exit). */
export const applyThemePref = (): void => {
  const dark = isDark();
  document.documentElement.classList.toggle('dark', dark);
  paintBrowserBar(dark);
};

/** Matches the phone's status bar / browser toolbar to the app background (same values as styles.css). */
/** What the header looks like: 78% of --surface over --background (styles.css .glass), per theme. */
export const HEADER_DARK = '#101829';
export const HEADER_LIGHT = '#fdfdfe';

export const paintBrowserBar = (dark: boolean): void => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  // The header's real color (the glass surface over the page), so the status bar and the header read as one.
  if (meta) meta.content = dark ? HEADER_DARK : HEADER_LIGHT;
  // iPhone (installed app): the status bar shows the page background, not theme-color. In the dark theme it goes
  // translucent so the header (which pads itself by the safe area) shows behind it; the light theme keeps the
  // default bar, whose dark text stays readable. iOS reads this when the app opens.
  const bar = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (bar) bar.content = dark ? 'black-translucent' : 'default';
};

export const setThemePref = (pref: ThemePref): void => {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // storage unavailable
  }
  applyThemePref();
  for (const listener of listeners) listener(pref);
};

/** One shared theme state for the header toggle and the settings page; "system" follows the OS. */
export const useThemePref = (): [ThemePref, (pref: ThemePref) => void] => {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  useEffect(() => {
    listeners.add(setPref);
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const onChange = () => getThemePref() === 'system' && applyThemePref();
    media?.addEventListener?.('change', onChange);
    return () => {
      listeners.delete(setPref);
      media?.removeEventListener?.('change', onChange);
    };
  }, []);
  return [pref, setThemePref];
};
