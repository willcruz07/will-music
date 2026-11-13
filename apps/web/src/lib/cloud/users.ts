import { doc, getDocFromServer, getFirestore, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { cloudApp, cloudAuth } from './firebase.ts';
import { emptyMusicianProfile, readContributions, readMusicianProfile, validateMusicianDetails, type MusicianAccount, type MusicianDetails } from '../musicianProfile.ts';
import { normalizeInviteEmail } from '../sharingTypes.ts';

export type AccountProfile = { name: string; email: string; photo: string | null };
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() ? value : '';

/** One document per Firebase UID, compatible with Alt7. Never overwrite preferences or roles. */
export const saveAccountProfile = async (user: User): Promise<AccountProfile> => {
  if (!user.uid || cloudAuth.currentUser?.uid !== user.uid) throw new Error('A sessão mudou antes de salvar o perfil.');
  const ref = doc(getFirestore(cloudApp), 'users', user.uid);
  return runTransaction(getFirestore(cloudApp), async transaction => {
    const snapshot = await transaction.get(ref);
    if (cloudAuth.currentUser?.uid !== user.uid) throw new Error('A sessão mudou antes de salvar o perfil.');
    const stored = snapshot.exists() ? snapshot.data() : {};
    const profile: AccountProfile = {
      name: nonEmpty(stored.name) || user.displayName || '',
      email: user.email || nonEmpty(stored.email),
      photo: nonEmpty(stored.photoURL) || user.photoURL || null,
    };
    if (!snapshot.exists()) {
      transaction.set(ref, { name: profile.name, email: profile.email, photoURL: profile.photo || '',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastAuth: serverTimestamp(),
        musicianProfile: emptyMusicianProfile(),
        notification: [], preferences: { pushEnabled: true, publicSetlistDefault: true, collabSetlistDefault: false } });
    } else {
      const patch: Record<string, unknown> = { lastAuth: serverTimestamp(), updatedAt: serverTimestamp() };
      if (user.email) patch.email = user.email;
      if (!nonEmpty(stored.name) && user.displayName) patch.name = user.displayName;
      if (!nonEmpty(stored.photoURL) && user.photoURL) patch.photoURL = user.photoURL;
      transaction.update(ref, patch);
    }
    if (user.email) transaction.set(doc(getFirestore(cloudApp), 'wmInvitePreferences', normalizeInviteEmail(user.email)), { acceptsInvites: readMusicianProfile(stored.musicianProfile).acceptsInvites });
    return profile;
  });
};

const currentProfileUser = (uid: string) => {
  const user = cloudAuth.currentUser;
  if (!user || user.uid !== uid) throw new Error('A sessão mudou. Entre novamente para salvar o perfil.');
  return user;
};
export const loadMusicianAccount = async (uid: string): Promise<MusicianAccount> => {
  const user = currentProfileUser(uid);
  const snapshot = await getDocFromServer(doc(getFirestore(cloudApp), 'users', uid));
  currentProfileUser(uid);
  const stored = snapshot.exists() ? snapshot.data() : {};
  return { name: nonEmpty(stored.name) || user.displayName || '', musicianProfile: readMusicianProfile(stored.musicianProfile), contributions: readContributions(stored.willMusicStats?.contributions) };
};
export const saveMusicianAccount = async (uid: string, input: MusicianDetails): Promise<void> => {
  const user = currentProfileUser(uid); const details = validateMusicianDetails(input);
  const email = normalizeInviteEmail(user.email || '');
  const firestore = getFirestore(cloudApp); const ref = doc(firestore, 'users', uid);
  await runTransaction(firestore, async transaction => {
    const snapshot = await transaction.get(ref); currentProfileUser(uid);
    const patch = { name: details.name, musicianProfile: details.musicianProfile, updatedAt: serverTimestamp() };
    if (snapshot.exists()) transaction.update(ref, patch);
    else transaction.set(ref, { ...patch, email: user.email, photoURL: user.photoURL || '', createdAt: serverTimestamp(), lastAuth: serverTimestamp(), notification: [], preferences: { pushEnabled: true, publicSetlistDefault: true, collabSetlistDefault: false } });
    transaction.set(doc(firestore, 'wmInvitePreferences', email), { acceptsInvites: details.musicianProfile.acceptsInvites });
  });
  currentProfileUser(uid);
};
