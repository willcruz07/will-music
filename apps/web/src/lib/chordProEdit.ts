/** Sets {title} and {artist} at the top of a ChordPro text (artist removed when empty); everything else is kept. */
export const setChordProMeta = (chordPro: string, meta: { title: string; artist: string }): string => {
  const body = chordPro
    .split('\n')
    .filter((line) => !/^\s*\{\s*(title|t|artist)\s*:/iu.test(line));
  const header = [`{title: ${meta.title}}`, ...(meta.artist ? [`{artist: ${meta.artist}}`] : [])];
  return [...header, ...body].join('\n');
};
