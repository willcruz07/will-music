import { describe, expect, it } from 'vitest';
import { emptyMusicianProfile, readContributions, readMusicianProfile, socialLink, validateMusicianDetails } from '../src/lib/musicianProfile.ts';

describe('musician profile data', () => {
  it('reads partial legacy data safely without opting into invitations', () => {
    expect(readMusicianProfile(undefined)).toEqual(emptyMusicianProfile());
    expect(readMusicianProfile({ instruments: ['Piano', 'Piano', 'unknown'], styles: ['Jazz'], experience: 'constructor', acceptsInvites: 'true' })).toMatchObject({ instruments: ['Piano'], styles: ['Jazz'], experience: '', acceptsInvites: false });
  });
  it('normalizes social handles and restricts executable links and wrong hosts', () => {
    expect(socialLink('instagram', '@will.cruz')).toBe('https://www.instagram.com/will.cruz');
    expect(socialLink('tiktok', 'will')).toBe('https://www.tiktok.com/@will');
    expect(socialLink('website', 'will.example.com')).toBe('https://will.example.com/');
    for (const value of ['javascript:alert(1)', 'http://instagram.com/a', 'https://instagram.com.evil.test/a', 'https://user:pass@instagram.com/a']) expect(() => socialLink('instagram', value)).toThrow();
  });
  it('validates lengths and whitelists editable fields only', () => {
    const profile = emptyMusicianProfile();
    const value = validateMusicianDetails({ name: ' Will ', musicianProfile: { ...profile, nickname: ' Wellen ', socials: { ...profile.socials, instagram: '@will' } } });
    expect(value.name).toBe('Will'); expect(value.musicianProfile.nickname).toBe('Wellen');
    expect(value.musicianProfile.socials.instagram).toBe('https://www.instagram.com/will');
    expect(() => validateMusicianDetails({ name: '', musicianProfile: profile })).toThrow();
    expect(() => validateMusicianDetails({ name: 'Will', musicianProfile: { ...profile, bio: 'a'.repeat(601) } })).toThrow();
    expect(Object.keys(value)).toEqual(['name', 'musicianProfile']);
  });
  it('does not invent a contribution count from invalid or missing data', () => {
    for (const value of [undefined, '10', -1, 1.5, Infinity]) expect(readContributions(value)).toBeNull();
    expect(readContributions(0)).toBe(0); expect(readContributions(12)).toBe(12);
  });
});
