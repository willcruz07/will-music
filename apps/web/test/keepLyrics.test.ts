import { describe, expect, it } from 'vitest';
import { lyricsToKeep } from '../src/lib/lyricsApply.ts';

describe('re-analysis keeps lyrics the user chose', () => {
  it('keeps pasted or picked lyrics and drops automatic ones', () => {
    const lines = [{ start: 1, text: 'x' }];
    expect(lyricsToKeep({ source: 'manual', lines })).toEqual({ source: 'manual', lines });
    expect(lyricsToKeep({ source: 'lrclib', lrclibId: 3, lines, chosenByUser: true })).toMatchObject({ lrclibId: 3 });
    expect(lyricsToKeep({ source: 'lrclib', lrclibId: 3, lines })).toBeUndefined();
    expect(lyricsToKeep(undefined)).toBeUndefined();
  });
});
