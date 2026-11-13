export const validArtistPhoto = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
};
