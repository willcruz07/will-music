import { isKnownChord } from './chordNotation.ts';

/** A line made only of chord names (the usual "cifra" layout puts them above the lyric). */
export const isChordLine = (line: string): boolean => {
  const tokens = line.trim().split(/\s+/u).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => isKnownChord(t));
};

const isDirective = (line: string) => /^\s*\{.*\}\s*$/u.test(line);

/** One ChordPro line as a chord line above its lyric (or null when it has no chords). */
const lineToSheet = (line: string): string | null => {
  let lyric = '';
  let chords = '';
  for (const part of line.split(/(\[[^\]]*\])/u)) {
    const m = /^\[([^\]]*)\]$/u.exec(part);
    if (!m) {
      lyric += part;
      continue;
    }
    const at = Math.max(lyric.length, chords.length ? chords.length + 1 : 0);
    chords = chords.padEnd(at, ' ') + m[1];
  }
  return chords ? `${chords}\n${lyric}` : null;
};

/**
 * ChordPro → the familiar layout: each chord on the line above, over the letter where it starts.
 * Only lines that come back exactly the same are changed; anything else (unknown chord names, chords
 * closer together than their syllables, chord-only lines, [x2] marks…) stays in ChordPro form, so
 * editing in this layout never loses or moves a chord.
 */
export const chordProToSheet = (chordPro: string): string =>
  chordPro
    .split('\n')
    .map((line) => {
      if (!line.includes('[') || isDirective(line)) return line;
      const sheet = lineToSheet(line);
      if (!sheet || !sheet.split('\n')[1]!.trim()) return line; // chord-only: keep [C] [G] so it never joins the next line
      return sheetToChordPro(sheet) === line ? sheet : line;
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
    if (next === undefined || !next.trim() || isDirective(next) || isChordLine(next) || next.includes('[')) {
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

/** True when the chart survives the chord-above layout exactly (otherwise edit it in ChordPro). */
export const isLossless = (chordPro: string): boolean => sheetToChordPro(chordProToSheet(chordPro)) === chordPro;

/**
 * Puts a chord in the chord-above layout at the cursor's column: in the chord line the cursor is on,
 * in the chord line above the cursor's lyric, or in a new chord line created above it.
 */
export const insertChordInSheet = (sheet: string, caret: number, chord: string): { text: string; caret: number } => {
  const lines = sheet.split('\n');
  let start = 0;
  let index = 0;
  while (index < lines.length - 1 && start + lines[index]!.length < caret) {
    start += lines[index]!.length + 1;
    index++;
  }
  const col = Math.max(0, caret - start);
  const place = (line: string) => {
    let at = col;
    // Never write over another chord: go to the first free spot after it.
    while (line.slice(at, at + chord.length + 1).trim() || (at > 0 && line[at - 1] && line[at - 1] !== ' ')) {
      const next = line.indexOf(' ', at);
      at = next < 0 ? line.length + 1 : next + 1;
    }
    return `${line.padEnd(at, ' ').slice(0, at)}${chord}${line.slice(at + chord.length)}`;
  };
  if (isChordLine(lines[index]!)) {
    lines[index] = place(lines[index]!);
    return { text: lines.join('\n'), caret: start + col + chord.length };
  }
  if (index > 0 && isChordLine(lines[index - 1]!)) {
    lines[index - 1] = place(lines[index - 1]!);
    const text = lines.join('\n');
    return { text, caret: caret + (text.length - sheet.length) };
  }
  lines.splice(index, 0, place(''));
  const text = lines.join('\n');
  return { text, caret: caret + (text.length - sheet.length) };
};

/** A caret inside "[G]" moves past it, so an inserted chord never lands inside another. */
export const snapOutOfBrackets = (text: string, caret: number): number => {
  const open = text.lastIndexOf('[', caret - 1);
  const close = text.lastIndexOf(']', caret - 1);
  if (open > close) {
    const end = text.indexOf(']', caret);
    if (end >= 0) return end + 1;
  }
  return caret;
};
