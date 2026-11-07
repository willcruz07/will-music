/** Sets {title} and {artist} at the top of a ChordPro text (artist removed when empty); everything else is kept. */
export const setChordProMeta = (chordPro: string, meta: { title: string; artist: string }): string => {
  const body = chordPro
    .split('\n')
    .filter((line) => !/^\s*\{\s*(title|t|artist)\s*:/iu.test(line));
  const header = [`{title: ${meta.title}}`, ...(meta.artist ? [`{artist: ${meta.artist}}`] : [])];
  return [...header, ...body].join('\n');
};

const isLyricLine = (line: string): boolean =>
  line.trim() !== '' && !/^\s*\{.*\}\s*$/u.test(line) && !/^(\s*\[[^\]]+\]\s*)+$/u.test(line);

/** Inserts, replaces or (chord = null) removes the chord before plain character `charIndex` of the k-th lyric line. */
export const setChordAt = (chordPro: string, lyricLineIndex: number, charIndex: number, chord: string | null): string => {
  const lines = chordPro.split('\n');
  let k = -1;
  const row = lines.findIndex((line) => isLyricLine(line) && ++k === lyricLineIndex);
  if (row < 0) return chordPro;
  const line = lines[row]!;
  let plain = 0;
  let i = 0;
  let out = '';
  let done = false;
  while (i <= line.length) {
    const tag = /^\[[^\]]*\]/u.exec(line.slice(i));
    if (!done && plain === charIndex) {
      if (tag) i += tag[0].length;
      if (chord) out += `[${chord}]`;
      done = true;
      continue;
    }
    if (tag) {
      out += tag[0];
      i += tag[0].length;
      continue;
    }
    if (i < line.length) out += line[i];
    i += 1;
    plain += 1;
  }
  lines[row] = out;
  return lines.join('\n');
};
