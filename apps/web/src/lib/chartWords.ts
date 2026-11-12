export type LyricPiece = { text: string; offset: number; chord?: string };
export type LyricWord = { kind: 'word'; pieces: LyricPiece[] } | { kind: 'space'; text: string };

/** Wrap at word boundaries, not at ChordPro fragments, preserving mid-word chords and edit offsets. */
export const lyricWords = (parts: { text: string; chord?: string }[]): LyricWord[] => {
  const output: LyricWord[] = [];
  let word: Extract<LyricWord, { kind: 'word' }> | null = null;
  let offset = 0;
  let queued: string[] = [];
  for (const part of parts) {
    if (part.chord) queued.push(part.chord);
    for (const match of part.text.matchAll(/\s+|\S+/gu)) {
      const text = match[0];
      if (/^\s/u.test(text)) { output.push({ kind: 'space', text }); word = null; }
      else {
        if (!word) { word = { kind: 'word', pieces: [] }; output.push(word); }
        word.pieces.push({ text, offset: offset + match.index, ...(queued.length ? { chord: queued.join(' ') } : {}) });
        queued = [];
      }
    }
    offset += part.text.length;
  }
  if (queued.length) output.push({ kind: 'word', pieces: [{ text: '', offset, chord: queued.join(' ') }] });
  return output;
};
