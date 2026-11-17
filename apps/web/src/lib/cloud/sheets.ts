/** Link sharing of written scores: one document per shared score (`wmSheets/{id}`), so opening a link costs one read. */
import { collection, deleteDoc, doc, getDocFromServer, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { cloudApp } from './firebase.ts';
import type { Sheet } from '../sheet/model.ts';
import { getSharedSheet, keepSharedSheet, type SharedSheetRecord } from '../sheet/store.ts';

const firestore = getFirestore(cloudApp);
const MAX_BYTES = 800_000;

const owner = async () => {
  const [{ cloudAuth }, { getAccountState }] = await Promise.all([import('./firebase.ts'), import('../account.ts')]);
  const user = getAccountState().user;
  if (!user || cloudAuth.currentUser?.uid !== user.uid) throw new Error('Entre na sua conta para compartilhar.');
  return user;
};

/** What is published: the score without device-only fields. */
const publicCopy = (sheet: Sheet): Sheet => {
  const { shared: _s, sharedFrom: _f, songId: _song, ...rest } = sheet;
  return rest as Sheet;
};

export const sheetShareUrl = (id: string): string => `${location.origin}/partitura/compartilhada/${encodeURIComponent(id)}`;

/** Publishes (or updates) the shared copy; returns the link id and when it was published. */
export const publishSheet = async (sheet: Sheet): Promise<{ id: string; publishedAt: string }> => {
  if (!navigator.onLine) throw new Error('Conecte-se para publicar a partitura.');
  const user = await owner();
  const payload = publicCopy(sheet);
  if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_BYTES) throw new Error('A partitura ficou grande demais para compartilhar. Divida em partes menores.');
  const ref = sheet.shared?.id ? doc(firestore, 'wmSheets', sheet.shared.id) : doc(collection(firestore, 'wmSheets'));
  await setDoc(ref, { ownerUid: user.uid, ownerName: user.name || 'Professor', title: sheet.title.slice(0, 200), sheet: payload, updatedAt: serverTimestamp() });
  return { id: ref.id, publishedAt: new Date().toISOString() };
};

export const unpublishSheet = async (id: string): Promise<void> => {
  if (!navigator.onLine) throw new Error('Conecte-se para parar de compartilhar.');
  await owner();
  await deleteDoc(doc(firestore, 'wmSheets', id));
};

/** Opens a shared score: fresh from the server when online (and kept on the device), the kept copy offline. */
export const openSharedSheet = async (id: string): Promise<SharedSheetRecord> => {
  if (!id || id.includes('/')) throw new Error('Link de partitura inválido.');
  const kept = await getSharedSheet(id);
  if (!navigator.onLine) {
    if (kept) return kept;
    throw new Error('Você está offline e esta partitura ainda não foi aberta neste aparelho.');
  }
  try {
    const snapshot = await getDocFromServer(doc(firestore, 'wmSheets', id));
    if (!snapshot.exists()) throw new Error('Esta partitura não está mais compartilhada.');
    const data = snapshot.data() as { ownerUid: string; ownerName: string; sheet: Sheet; updatedAt?: { toDate?: () => Date } };
    const record: SharedSheetRecord = { id, ownerUid: data.ownerUid, ownerName: data.ownerName || 'Professor', sheet: data.sheet, updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(), openedAt: new Date().toISOString() };
    await keepSharedSheet(record);
    return record;
  } catch (error) {
    if (kept) return kept;
    throw error;
  }
};
