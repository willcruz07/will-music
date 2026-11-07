import { isKnownChord } from './chordNotation.ts';

/** A line made only of chord names (the usual "cifra" layout puts them above the lyric). */
export const isChordLine = (line: string): boolean => {
  const tokens = line.trim().split(/\s+/u).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => isKnownChord(t));
};

const isDirective = (line: string) => /^\s*\{.*\}\s*$/u.test(line);

/** ChordPro → the familiar layout: each chord on the line above, over the letter where it starts. */
export const chordProToSheet = (chordPro: string): string =>
  chordPro
    .split('\n')
    .map((line) => {
      if (!line.includes('[') || isDirective(line)) return line;
      let lyric = '';
      let chords = '';
      for (const part of line.split(/(\[[^\]]*\])/u)) {
        const m = /^\[([^\]]*)\]$/u.exec(part);
        if (!m) {
          lyric += part;
          continue;
        }
        // Two chords on the same spot are kept apart by a space.
        const at = Math.max(lyric.length, chords.length ? chords.length + 1 : 0);
        chords = chords.padEnd(at, ' ') + m[1];
      }
      return lyric.trim() ? `${chords}\n${lyric}` : chords;
    })
    .join('\n');

/** The familiar layout → ChordPro: each chord goes into the lyric below at the same column. */
export const sheetToChordPro = (sheet: string): string => {
  const lines = sheet.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!isChordLine(line) || isDirective(line)) {
      out.push(line);
      continue;
    }
    const chords = [...line.matchAll(/\S+/gu)].map((m) => ({ at: m.index, chord: m[0] }));
    const next = lines[i + 1];
    if (next === undefined || !next.trim() || isDirective(next) || isChordLine(next)) {
      out.push(chords.map((c) => `[${c.chord}]`).join(' '));
      continue;
    }
    let lyric = next;
    for (const c of [...chords].reverse()) {
      if (c.at > lyric.length) lyric = lyric.padEnd(c.at, ' ');
      lyric = `${lyric.slice(0, c.at)}[${c.chord}]${lyric.slice(c.at)}`;
    }
    out.push(lyric);
    i++;
  }
  return out.join('\n');
};
