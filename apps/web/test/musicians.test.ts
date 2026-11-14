import { describe, expect, it } from 'vitest';
import { emptyMusicianProfile, readMusicianProfile } from '../src/lib/musicianProfile.ts';
import { musicianTag, normalizeMusicianName, publicMusicianData, readPublicMusician } from '../src/lib/musicians.ts';

describe('public musician projection', () => {
  it('keeps legacy profiles private and generates only explicitly public fields', () => {
    expect(emptyMusicianProfile().discoverable).toBe(false);
    expect(readMusicianProfile({ nickname: 'Will' }).discoverable).toBe(false);
    const data = publicMusicianData({ name: 'Nome privado', musicianProfile: { ...emptyMusicianProfile(), nickname: 'Will', discoverable: true, instruments: ['Teclado'], styles: ['Jazz', 'Gospel'] } }, 'https://example.com/avatar.jpg');
    expect(data.name).toBe('Will'); expect(data.searchName).toBe('will');
    expect(data.tags).toContain(musicianTag('Teclado', 'Jazz'));
    expect(data).not.toHaveProperty('email'); expect(data).not.toHaveProperty('uid');
    expect(data).not.toHaveProperty('contributions'); expect(data).not.toHaveProperty('discoverable');
    expect(Object.keys(data).sort()).toEqual(['name', 'photo', 'bio', 'location', 'instruments', 'styles', 'experience', 'socials', 'acceptsInvites', 'searchName', 'tags'].sort());
  });
  it('normalizes name searches and strips invalid links from a received profile', () => {
    expect(normalizeMusicianName('  JOÃO   Cláudio ')).toBe('joao claudio');
    const value = readPublicMusician('musician', { name: 'João', socials: { website: 'javascript:alert(1)', instagram: '@joao' }, acceptsInvites: true });
    expect(value.socials.website).toBe(''); expect(value.socials.instagram).toBe('https://www.instagram.com/joao');
    expect(value.acceptsInvites).toBe(true);
  });
});
