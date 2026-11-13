import { validateProfileLocation } from './brazilLocations.ts';
export const MUSICAL_INSTRUMENTS = ['Voz', 'Violão', 'Guitarra', 'Teclado', 'Piano', 'Cavaquinho', 'Baixo', 'Bateria', 'Percussão', 'Violino', 'Saxofone', 'Flauta', 'Acordeon', 'Ukulele', 'Outros'];
export const MUSICAL_STYLES = ['Gospel', 'Adoração', 'MPB', 'Samba', 'Pagode', 'Bossa nova', 'Jazz', 'Blues', 'Rock', 'Pop', 'Soul', 'Funk', 'Sertanejo', 'Forró', 'Reggae', 'Clássica', 'Instrumental', 'Outros'];
export const MUSICAL_LEVELS = { starting: 'Começando agora', learning: 'Em desenvolvimento', experienced: 'Experiente', professional: 'Atuação profissional' } as const;
export type MusicianProfile = {
  nickname: string; bio: string;
  location: { city: string; region: string; country: string };
  instruments: string[]; styles: string[];
  experience: '' | keyof typeof MUSICAL_LEVELS;
  acceptsInvites: boolean;
  socials: { instagram: string; youtube: string; tiktok: string; facebook: string; website: string };
};
export type MusicianDetails = { name: string; musicianProfile: MusicianProfile };
export type MusicianAccount = MusicianDetails & { contributions: number | null };
export const emptyMusicianProfile = (): MusicianProfile => ({ nickname: '', bio: '', location: { city: '', region: '', country: '' }, instruments: [], styles: [], experience: '', acceptsInvites: false, socials: { instagram: '', youtube: '', tiktok: '', facebook: '', website: '' } });
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const choices = (value: unknown, allowed: string[]) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && allowed.includes(item)))].slice(0, allowed.length) : [];
/** Defensive reader for legacy/partial documents; the writer validates rather than truncating. */
export const readMusicianProfile = (value: unknown): MusicianProfile => {
  const input = value && typeof value === 'object' ? value as Partial<MusicianProfile> : {};
  const blank = emptyMusicianProfile();
  return { nickname: text(input.nickname, 40), bio: text(input.bio, 600), location: { city: text(input.location?.city, 80), region: text(input.location?.region, 80), country: text(input.location?.country, 60) }, instruments: choices(input.instruments, MUSICAL_INSTRUMENTS), styles: choices(input.styles, MUSICAL_STYLES), experience: input.experience && Object.hasOwn(MUSICAL_LEVELS, input.experience) ? input.experience : '', acceptsInvites: input.acceptsInvites === true, socials: Object.fromEntries(Object.keys(blank.socials).map(key => [key, text(input.socials?.[key as keyof MusicianProfile['socials']], 300)])) as MusicianProfile['socials'] };
};
const socialHosts = { instagram: ['instagram.com'], youtube: ['youtube.com', 'youtu.be'], tiktok: ['tiktok.com'], facebook: ['facebook.com', 'fb.com'] };
export const socialLink = (kind: keyof MusicianProfile['socials'], value: string): string => {
  if (!value.trim()) return '';
  let raw = value.trim();
  if ((kind === 'instagram' || kind === 'tiktok') && /^@?[a-zA-Z0-9._]+$/u.test(raw)) raw = `https://www.${kind}.com/${kind === 'tiktok' ? '@' : ''}${raw.replace(/^@/u, '')}`;
  if (!/^\w+:/u.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`Confira o endereço de ${kind === 'website' ? 'seu site' : kind}.`); }
  const hosts = kind === 'website' ? null : socialHosts[kind];
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || (hosts && !hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)))) throw new Error(`Use um endereço HTTPS válido de ${kind === 'website' ? 'seu site' : kind}.`);
  if (url.href.length > 300) throw new Error('Use um link mais curto, com até 300 caracteres.');
  return url.href;
};
export const validateMusicianDetails = (input: MusicianDetails): MusicianDetails => {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 90) throw new Error('Informe seu nome, com até 90 caracteres.');
  const profile = input.musicianProfile;
  for (const [value, max, label] of [[profile.nickname, 40, 'apelido'], [profile.bio, 600, 'apresentação'], [profile.location.city, 80, 'cidade'], [profile.location.region, 80, 'estado'], [profile.location.country, 60, 'país']] as const) if (typeof value !== 'string' || value.trim().length > max) throw new Error(`Confira o campo ${label} (até ${max} caracteres).`);
  const normalized = readMusicianProfile(profile);
  normalized.location = validateProfileLocation(normalized.location);
  for (const key of Object.keys(normalized.socials) as (keyof MusicianProfile['socials'])[]) {
    if (typeof profile.socials[key] !== 'string' || profile.socials[key].length > 300) throw new Error('Os links devem ter até 300 caracteres.');
    normalized.socials[key] = socialLink(key, profile.socials[key]);
  }
  return { name: input.name.trim(), musicianProfile: normalized };
};
export const readContributions = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
