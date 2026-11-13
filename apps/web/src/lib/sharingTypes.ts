import type { Chart, Setlist, Song } from './db.ts';

export type PersonalChart = { song: Song; chart: Chart };
export type SharedItem = { id: string; order: number; song: Song; chart: Chart; targetKey?: string; transpose?: number; note?: string };
export type SharedSetlist = { id: string; inviteId: string; ownerUid: string; ownerName: string; ownerPhoto: string; name: string; version: number; items: SharedItem[]; updatedAt: string };
export type SetlistInvite = { id: string; shareId: string; senderUid: string; senderName: string; senderPhoto: string; recipientEmail: string; recipientUid?: string; name: string; itemCount: number; offeredVersion: number; acceptedVersion: number; declinedVersion: number; status: 'pending' | 'accepted' | 'declined'; updatedAt: string };
export type CloudEntity = { revision: number; deleted: boolean; payload: PersonalChart | Setlist | null };
export const LIBRARY_CHANGED = 'wm-library-changed';
export const notifyLibraryChanged = () => window.dispatchEvent(new Event(LIBRARY_CHANGED));
export const invitationNeedsAction = (invite: SetlistInvite) => invite.status === 'pending' || (invite.status === 'accepted' && invite.offeredVersion > Math.max(invite.acceptedVersion, invite.declinedVersion));
export const cleanWire = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const stableWire = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export const fingerprint = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableWire(value))))].map(byte => byte.toString(16).padStart(2, '0')).join('');
export const normalizeInviteEmail = (email: string): string => {
  const value = email.trim().toLowerCase();
  if (value.length > 200 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/u.test(value)) throw new Error('Informe o e-mail da conta Google de quem vai receber.');
  return value;
};
export const personalChart = (song: Song, chart: Chart): PersonalChart => cleanWire({
  song: { id: song.id, title: song.title, artist: song.artist, durationSec: 0, key: song.key, tempo: song.tempo, capo: song.capo, timeSignature: song.timeSignature, folder: song.folder, favorite: song.favorite, analysisStatus: 'done', createdAt: song.createdAt, updatedAt: song.updatedAt, catalogSource: song.catalogSource },
  chart: { id: `${song.id}-chart`, songId: song.id, chordPro: chart.chordPro, transpose: chart.transpose, fontSize: chart.fontSize, origin: chart.origin, chordShapes: chart.chordShapes, chordInstrument: chart.chordInstrument, createdAt: chart.createdAt, updatedAt: chart.updatedAt },
});
export const checkedPersonalChart = (value: unknown): PersonalChart => {
  const data = value as PersonalChart;
  if (!data?.song || !data.chart || typeof data.song.id !== 'string' || typeof data.song.title !== 'string' || typeof data.song.artist !== 'string' || typeof data.chart.id !== 'string' || typeof data.chart.chordPro !== 'string' || data.chart.chordPro.length > 300000 || !Number.isFinite(data.chart.transpose) || !Number.isFinite(data.chart.fontSize)) throw new Error('A cifra recebida possui dados inválidos.');
  if (!data.song.id || data.song.id.length > 200 || data.chart.songId !== data.song.id
    || data.chart.fontSize < 8 || data.chart.fontSize > 200 || Math.abs(data.chart.transpose) > 120
    || (data.song.key !== undefined && typeof data.song.key !== 'string')
    || (data.chart.chordInstrument !== undefined && !['violao', 'teclado', 'cavaquinho'].includes(data.chart.chordInstrument))
    || (data.chart.chordShapes !== undefined && (!data.chart.chordShapes || typeof data.chart.chordShapes !== 'object' || Array.isArray(data.chart.chordShapes)
      || Object.values(data.chart.chordShapes).some(shape => !shape || !['violao', 'teclado', 'cavaquinho'].includes(shape.instrument) || !Number.isInteger(shape.variant) || shape.variant < 0)))) throw new Error('A cifra recebida possui configurações inválidas.');
  return personalChart(data.song, data.chart);
};
export const checkedSetlist = (value: unknown): Setlist => {
  const data = value as Setlist;
  if (!data || typeof data.id !== 'string' || typeof data.name !== 'string' || !Array.isArray(data.items) || data.items.length > 500 || data.items.some(item => !item || typeof item.songId !== 'string')) throw new Error('A setlist recebida possui dados inválidos.');
  if (data.items.some(item => (item.targetKey !== undefined && typeof item.targetKey !== 'string') || (item.transpose !== undefined && (!Number.isFinite(item.transpose) || Math.abs(item.transpose) > 120)) || (item.note !== undefined && typeof item.note !== 'string') || (item.id !== undefined && typeof item.id !== 'string'))) throw new Error('A setlist recebida possui configurações inválidas.');
  return cleanWire({ id: data.id, name: data.name, date: data.date, createdAt: data.createdAt, updatedAt: data.updatedAt, items: data.items.map(item => ({ id: item.id, songId: item.songId, targetKey: item.targetKey, transpose: item.transpose, note: item.note })) });
};
