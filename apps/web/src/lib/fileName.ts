const tidy = (s: string): string => s.replace(/\s+/gu, ' ').trim();

const dropFeaturing = (s: string): string => s.replace(/\s+(?:ft|feat|part)\.?\s+.*$/iu, '');

const unshout = (s: string): string =>
  /\p{Ll}/u.test(s) ? s : s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase());

/** Best guess of title and artist from names like "Artista - Música (Ao Vivo) [Official Video].mp3". */
export const guessFromFileName = (fileName: string): { title: string; artist: string } => {
  let name = fileName.replace(/\.[^.]+$/u, '');
  name = name.replace(/-[A-G][#b]?(?: (?:major|minor))?-\d+bpm-\d+hz$/iu, '');
  name = /\(youtube\)$/iu.test(name) ? name.replace(/\s+-\s+[^-]*\(youtube\)$/iu, '').replace(/\(youtube\)$/iu, '') : name;
  name = name.replace(/\([^)]*\)|\[[^\]]*\]/gu, ' ');

  let title = name;
  let artist = '';
  if (/\s-\s/u.test(name)) {
    const [first, ...rest] = name.split(/\s+-\s+/u);
    artist = first ?? '';
    title = rest.join(' - ');
  } else {
    const parts = name.split(/\s*[｜|]\s*|\s{2,}/u).filter((p) => p.trim());
    if (parts.length >= 2) {
      title = parts[0]!;
      artist = parts.slice(1).join(' ');
    }
  }
  return { title: unshout(tidy(dropFeaturing(title))), artist: tidy(dropFeaturing(artist)) };
};
