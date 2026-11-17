/**
 * Community options and ratings stored inside the catalog document itself (`cifras/{id}`), so opening a song
 * keeps costing a single read. Entries are grouped by the author's / rater's uid: Firestore rules can then check
 * `affectedKeys().hasOnly([request.auth.uid])`, so nobody touches another person's options or ratings.
 *
 * chordOptions.<uid> = { author: {uid,name,photo}, options: { <optionId>: { chordPro, createdAt, updatedAt } } }
 * chordRatings.<uid> = { name, photo, items: { main | <uid>_<optionId>: { stars, comment?, at } } }
 */

export type CatalogAuthor = { uid: string; name: string; photo: string };
export type CatalogOption = { key: string; id: string; author: CatalogAuthor; chordPro: string; createdAt: string; updatedAt: string };
export type CatalogRatingItem = { stars: number; comment?: string; at: string };
export type CatalogRatings = Record<string, { name: string; photo: string; items: Record<string, CatalogRatingItem> }>;
export type CatalogRatingEntry = CatalogRatingItem & { uid: string; name: string; photo: string };

export const MAIN_KEY = 'main';
export const MAX_OPTIONS_PER_AUTHOR = 3;
export const MAX_AUTHORS = 20;
export const MAX_CHORDPRO = 20000;
export const MAX_COMMENT = 200;
export const MAX_DOC_BYTES = 700_000;
const MIN_VOTES_FOR_HIGHLIGHT = 3;

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
/** Firestore Timestamp, ISO string or nothing → ISO string (empty when unknown). */
const when = (value: unknown): string => {
  if (typeof value === 'string') return value;
  const maybe = value as { toDate?: () => Date } | null;
  return typeof maybe?.toDate === 'function' ? maybe.toDate().toISOString() : '';
};
const author = (value: unknown, uid: string): CatalogAuthor => {
  const raw = record(value);
  return { uid, name: text(raw.name) || 'Músico', photo: text(raw.photo) };
};

export const optionKey = (authorUid: string, optionId: string): string => `${authorUid}_${optionId}`;

/** Reads the community fields of a catalog document; anything malformed is skipped, never thrown. */
export const parseCommunity = (data: Record<string, unknown>): { options: CatalogOption[]; ratings: CatalogRatings; author?: CatalogAuthor } => {
  const options: CatalogOption[] = [];
  for (const [uid, entry] of Object.entries(record(data.chordOptions))) {
    const raw = record(entry);
    const who = author(raw.author, uid);
    for (const [id, value] of Object.entries(record(raw.options))) {
      const option = record(value);
      const chordPro = text(option.chordPro);
      if (!chordPro.trim()) continue;
      options.push({ key: optionKey(uid, id), id, author: who, chordPro, createdAt: when(option.createdAt), updatedAt: when(option.updatedAt) });
    }
  }
  options.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key));
  const ratings: CatalogRatings = {};
  for (const [uid, entry] of Object.entries(record(data.chordRatings))) {
    const raw = record(entry);
    const items: Record<string, CatalogRatingItem> = {};
    for (const [key, value] of Object.entries(record(raw.items))) {
      const item = record(value);
      const stars = Number(item.stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) continue;
      items[key] = { stars, at: when(item.at), ...(text(item.comment).trim() ? { comment: text(item.comment).slice(0, MAX_COMMENT) } : {}) };
    }
    if (Object.keys(items).length) ratings[uid] = { name: text(raw.name) || 'Músico', photo: text(raw.photo), items };
  }
  const owner = record(data.author);
  return { options, ratings, ...(text(owner.uid) ? { author: author(owner, text(owner.uid)) } : {}) };
};

/** Every rating of one item (the main chart or an option), newest first. */
export const ratingsFor = (ratings: CatalogRatings, itemKey: string): CatalogRatingEntry[] =>
  Object.entries(ratings)
    .flatMap(([uid, entry]) => (entry.items[itemKey] ? [{ ...entry.items[itemKey]!, uid, name: entry.name, photo: entry.photo }] : []))
    .sort((a, b) => b.at.localeCompare(a.at));

export const ratingSummary = (entries: { stars: number }[]): { average: number; count: number } => {
  if (!entries.length) return { average: 0, count: 0 };
  return { average: entries.reduce((sum, e) => sum + e.stars, 0) / entries.length, count: entries.length };
};

/** The best-rated item with at least three ratings; ties go to more ratings, then the oldest. Else the main chart. */
export const highlightKey = (chart: { options: CatalogOption[]; ratings: CatalogRatings }): string => {
  const candidates = [{ key: MAIN_KEY, createdAt: '' }, ...chart.options]
    .map((item, order) => ({ key: item.key, order, ...ratingSummary(ratingsFor(chart.ratings, item.key)) }))
    .filter((item) => item.count >= MIN_VOTES_FOR_HIGHLIGHT);
  candidates.sort((a, b) => b.average - a.average || b.count - a.count || a.order - b.order);
  return candidates[0]?.key ?? MAIN_KEY;
};

/** Same text for comparison: line ends trimmed, repeated blank lines collapsed, line breaks unified. */
export const normalizeChordPro = (value: string): string =>
  value.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();

/** The key of the item whose text equals `value` ('main' or an option key), ignoring `ignoreKey`; null when new. */
export const duplicateOf = (chart: { chordPro: string; options: CatalogOption[] }, value: string, ignoreKey?: string): string | null => {
  const target = normalizeChordPro(value);
  if (normalizeChordPro(chart.chordPro) === target) return MAIN_KEY;
  return chart.options.find((o) => o.key !== ignoreKey && normalizeChordPro(o.chordPro) === target)?.key ?? null;
};

export const newOptionId = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `opt_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
};

/** Rough stored size of a document (UTF-8 JSON); enough to keep a margin below Firestore's 1 MiB. */
export const estimateBytes = (value: unknown): number => {
  try {
    return new TextEncoder().encode(JSON.stringify(value, (_k, v) => (typeof (v as { toDate?: unknown })?.toDate === 'function' ? '2026-01-01T00:00:00.000Z' : v))).length;
  } catch {
    return 0;
  }
};

export const slugify = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** "Opção 2" label for an option key, by order of submission; the main chart is "Principal". */
export const itemLabel = (options: CatalogOption[], key: string): string =>
  key === MAIN_KEY ? 'Principal' : `Opção ${options.findIndex((o) => o.key === key) + 1}`;
