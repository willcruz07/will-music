const NOTES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const normalizeAccidentals = (text: string): string => text.replace(/♯/gu, '#').replace(/♭/gu, 'b').replace(/𝄪/gu, '##').replace(/𝄫/gu, 'bb');
export const notePitchClass = (text: string): number | null => {
  const match = /^([A-G])([#b]{0,2})$/u.exec(normalizeAccidentals(text));
  if (!match) return null;
  const alteration = [...match[2]!].reduce((sum, c) => sum + (c === '#' ? 1 : -1), 0);
  return (NOTES[match[1]!]! + alteration + 12) % 12;
};
/** Numeric slashes belong to the extension; only a final slash followed by a note is a bass. */
export const parseChordToken = (input: string): { root: string; suffix: string; bass?: string } | null => {
  const text = normalizeAccidentals(input.trim()).replace(/\s*\/\s*/gu, '/');
  const bassMatch = /\/([A-Ga-g](?:#{1,2}|b{1,2})?)$/u.exec(text);
  const body = bassMatch ? text.slice(0, bassMatch.index) : text;
  const rootMatch = /^([A-Ga-g](?:#{1,2}|b{1,2})?)(.*)$/u.exec(body);
  if (!rootMatch || !/^(?:(?:maj|min|dim|aug|sus|add)|[mMΔø°º+^#b0-9(),/.\-\s])*$/iu.test(rootMatch[2]!)) return null;
  const root = rootMatch[1]![0]!.toUpperCase() + rootMatch[1]!.slice(1);
  const bass = bassMatch ? bassMatch[1]![0]!.toUpperCase() + bassMatch[1]!.slice(1) : undefined;
  return { root, suffix: rootMatch[2]!, ...(bass ? { bass } : {}) };
};
/** Split grouped labels without splitting spaces inside extension parentheses. */
export const splitChordLabels = (input: string): string[] => {
  const text = input.replace(/\s*\/\s*/gu, '/');
  let depth = 0; let token = ''; const parts: string[] = [];
  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s|\|/u.test(char)) { if (token) { parts.push(token); token = ''; } }
    else token += char;
  }
  if (token) parts.push(token);
  return parts.length > 1 && parts.every(part => parseChordToken(part)) ? parts : [input];
};
export const normalizeChordSuffix = (suffix: string): string => {
  let depth = 0; let output = '';
  const text = suffix.replace(/^min/iu, 'm').replace(/^[Δ^]7?/u, '7M').replace(/^-/u, 'm');
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === '/' && depth === 0) {
      const extension = /^([#b]?\d+)/u.exec(text.slice(i + 1));
      if (extension) { output += `(${extension[1]})`; i += extension[1]!.length; continue; }
    }
    output += char;
  }
  return output;
};
