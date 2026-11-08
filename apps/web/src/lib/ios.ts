/** iPhone, iPad or iPod (installed or in Safari). iPadOS reports a Mac, so touch points tell it apart. */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  return /macintosh/i.test(navigator.userAgent) && (navigator.maxTouchPoints ?? 0) > 1;
};

/**
 * Asks the system to treat the app's generated sound as playback (iOS 17+ `navigator.audioSession`), so the
 * study sounds play even with the iPhone in silent mode. Elsewhere it does nothing.
 */
export const preferPlayback = (): void => {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = 'playback';
  } catch {
    // older implementations reject the value; the silent-mode hint covers them
  }
};
