import { doc, getFirestore, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { cloudApp, cloudAuth } from './firebase.ts';

export type AccountProfile = { name: string; email: string; photo: string | null };
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim() ? value : '';

/** One document per Firebase UID, compatible with Alt7. Never overwrite preferences or roles. */
export const saveAccountProfile = async (user: User): Promise<AccountProfile> => {
  if (!user.uid || cloudAuth.currentUser?.uid !== user.uid) throw new Error('A sessão mudou antes de salvar o perfil.');
  const ref = doc(getFirestore(cloudApp), 'users', user.uid);
  return runTransaction(getFirestore(cloudApp), async transaction => {
    const snapshot = await transaction.get(ref);
    const stored = snapshot.exists() ? snapshot.data() : {};
    const profile: AccountProfile = {
      name: nonEmpty(stored.name) || user.displayName || '',
      email: user.email || nonEmpty(stored.email),
      photo: nonEmpty(stored.photoURL) || user.photoURL || null,
    };
    if (!snapshot.exists()) {
      transaction.set(ref, { name: profile.name, email: profile.email, photoURL: profile.photo || '',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastAuth: serverTimestamp(),
        notification: [], preferences: { pushEnabled: true, publicSetlistDefault: true, collabSetlistDefault: false } });
    } else {
      const patch: Record<string, unknown> = { lastAuth: serverTimestamp(), updatedAt: serverTimestamp() };
      if (user.email) patch.email = user.email;
      if (!nonEmpty(stored.name) && user.displayName) patch.name = user.displayName;
      if (!nonEmpty(stored.photoURL) && user.photoURL) patch.photoURL = user.photoURL;
      transaction.update(ref, patch);
    }
    return profile;
  });
};
