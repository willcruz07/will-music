import { readMusicianProfile, socialLink, type MusicianDetails, type MusicianProfile } from './musicianProfile.ts';
export type PublicMusician = { uid: string; name: string; photo: string; bio: string; location: MusicianProfile['location']; instruments: string[]; styles: string[]; experience: MusicianProfile['experience']; socials: MusicianProfile['socials']; acceptsInvites: boolean };
export type MusicianFilters = { name?: string; region?: string; city?: string; instrument?: string; style?: string };
export const normalizeMusicianName = (value: string) => value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/gu, ' ');
export const musicianTag = (instrument?: string, style?: string): string => instrument && style ? `is:${instrument}|${style}` : instrument ? `i:${instrument}` : style ? `s:${style}` : '';
export const publicMusicianData = (details: MusicianDetails, photo: string | null) => {
  const profile = details.musicianProfile;
  const name = profile.nickname || details.name;
  const tags = [...profile.instruments.map(instrument => musicianTag(instrument)), ...profile.styles.map(style => musicianTag('', style)), ...profile.instruments.flatMap(instrument => profile.styles.map(style => musicianTag(instrument, style)))];
  return { name, photo: photo && /^https:\/\//iu.test(photo) && photo.length <= 2048 ? photo : '', bio: profile.bio, location: profile.location, instruments: profile.instruments, styles: profile.styles, experience: profile.experience, socials: profile.socials, acceptsInvites: profile.acceptsInvites, searchName: normalizeMusicianName(name), tags };
};
export const readPublicMusician = (uid: string, input: unknown): PublicMusician => {
  const data = input as Record<string, unknown>;
  if (!data || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 90) throw new Error('Perfil musical inválido.');
  const profile = readMusicianProfile(data);
  for (const key of Object.keys(profile.socials) as (keyof MusicianProfile['socials'])[]) {
    try { profile.socials[key] = socialLink(key, profile.socials[key]); } catch { profile.socials[key] = ''; }
  }
  return { uid, name: data.name, photo: typeof data.photo === 'string' && /^https:\/\//iu.test(data.photo) ? data.photo : '', bio: profile.bio, location: profile.location, instruments: profile.instruments, styles: profile.styles, experience: profile.experience, socials: profile.socials, acceptsInvites: profile.acceptsInvites };
};
