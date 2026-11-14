import { collection, doc, getDocFromServer, getDocsFromServer, getFirestore, onSnapshot, or, orderBy, query, runTransaction, where, writeBatch } from 'firebase/firestore';
import { cloudApp, cloudAuth } from './firebase.ts';
import { getAccountState } from '../account.ts';
import { readPublicMusician } from '../musicians.ts';
import { db, now, type Setlist } from '../db.ts';
import { checkedPersonalChart, checkedSetlist, cleanWire, fingerprint, invitationNeedsAction, normalizeInviteEmail, notifyLibraryChanged, personalChart, type SetlistInvite, type SharedItem, type SharedSetlist } from '../sharingTypes.ts';

const firestore = getFirestore(cloudApp);
const requireUser = () => {
  const user = getAccountState().user;
  if (!user || cloudAuth.currentUser?.uid !== user.uid) throw new Error('Sua sessão mudou. Entre novamente.');
  if (!navigator.onLine) throw new Error('Conecte-se para enviar ou responder a um convite. As setlists já baixadas continuam disponíveis offline.');
  return user;
};
const sameUser = (uid: string) => { if (getAccountState().user?.uid !== uid || cloudAuth.currentUser?.uid !== uid) throw new Error('A conta mudou durante a operação.'); };
export const shareIdFor = (uid: string, listId: string) => `${uid}__${encodeURIComponent(listId)}`;
export const sharingError = (error: unknown) => {
  console.error('Compartilhamento de setlist falhou', error);
  const rawCode = (error as { code?: unknown })?.code;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  if (code?.includes('permission-denied')) return 'O Firebase não autorizou esta operação. As regras de compartilhamento precisam estar configuradas; seus dados locais foram mantidos.';
  if (code?.includes('failed-precondition')) return 'Falta um índice no Firebase para esta consulta. O console mostra o link de criação.';
  return error instanceof Error ? error.message : 'Não foi possível concluir esta operação.';
};
export const readInvite = (id: string, value: unknown): SetlistInvite => {
  const data = value as SetlistInvite;
  if (!data || typeof data.shareId !== 'string' || typeof data.senderUid !== 'string' || typeof data.recipientEmail !== 'string' || typeof data.name !== 'string' || !['pending', 'accepted', 'declined'].includes(data.status) || !Number.isInteger(data.offeredVersion)) throw new Error('Convite inválido.');
  if (!data.recipientEmail && (typeof data.recipientUid !== 'string' || !data.recipientUid)) throw new Error('Destinatário do convite inválido.');
  return { ...data, id, senderName: typeof data.senderName === 'string' ? data.senderName : 'Músico', senderPhoto: typeof data.senderPhoto === 'string' ? data.senderPhoto : '', acceptedVersion: data.acceptedVersion || 0, declinedVersion: data.declinedVersion || 0 };
};
export const isInviteRecipient = (invite: SetlistInvite, uid: string, email: string): boolean => invite.recipientUid === uid || (!!invite.recipientEmail && normalizeInviteEmail(email) === invite.recipientEmail);
export const watchInvites = (email: string, receive: (items: SetlistInvite[]) => void, fail: (error: unknown) => void) => {
  const uid = getAccountState().user?.uid;
  if (!uid || cloudAuth.currentUser?.uid !== uid) throw new Error('Sua sessão mudou. Entre novamente.');
  return onSnapshot(
  query(collection(firestore, 'wmInvites'), or(where('recipientEmail', '==', normalizeInviteEmail(email)), where('recipientUid', '==', uid)), orderBy('updatedAt', 'desc')),
  snapshot => { try { receive(snapshot.docs.map(item => readInvite(item.id, item.data()))); } catch (error) { fail(error); } }, fail,
  );
};

export const publishSetlist = async (list: Setlist): Promise<{ shareId: string; version: number; count: number }> => {
  const user = requireUser(); const local = db;
  if (!list.items.length || list.items.length > 100) throw new Error('Compartilhe setlists com 1 a 100 cifras.');
  const items: SharedItem[] = [];
  for (let order = 0; order < list.items.length; order++) {
    const item = list.items[order]!;
    const song = await local.songs.get(item.songId);
    const chart = await local.charts.where('songId').equals(item.songId).first();
    if (!song || !chart?.chordPro.trim()) throw new Error(`O item ${order + 1} não tem cifra salva. Revise o repertório antes de compartilhar.`);
    const content = personalChart(song, chart);
    if (new TextEncoder().encode(JSON.stringify(content)).length > 700000) throw new Error(`A cifra “${song.title}” é grande demais para compartilhar.`);
    items.push(cleanWire({ id: item.id ?? `${order}-${song.id}`, order, ...content, targetKey: item.targetKey, transpose: item.transpose, note: item.note }));
  }
  if (new TextEncoder().encode(JSON.stringify(items)).length > 5 * 1024 * 1024) throw new Error('O repertório está muito grande. Divida-o em duas setlists.');
  sameUser(user.uid);
  const shareId = shareIdFor(user.uid, list.id);
  const ref = doc(firestore, 'wmShares', shareId);
  const contentHash = await fingerprint({ name: list.name, ownerName: user.name, ownerPhoto: user.photo, items });
  const version = await runTransaction(firestore, async transaction => {
    sameUser(user.uid);
    const previous = await transaction.get(ref);
    if (previous.exists() && previous.data().fingerprint === contentHash) return previous.data().version as number;
    const next = previous.exists() ? (previous.data().version as number) + 1 : 1;
    const stamp = now();
    const header = { ownerUid: user.uid, ownerName: user.name || 'Músico', ownerPhoto: user.photo || '', name: list.name, version: next, itemCount: items.length, updatedAt: stamp };
    transaction.set(ref, { ...header, localListId: list.id, fingerprint: contentHash });
    transaction.set(doc(firestore, 'wmShares', shareId, 'versions', String(next)), header);
    for (const item of items) transaction.set(doc(firestore, 'wmShares', shareId, 'versions', String(next), 'items', String(item.order).padStart(3, '0')), item);
    return next;
  });
  return { shareId, version, count: items.length };
};

export const sendSetlistInvite = async (list: Setlist, email: string): Promise<void> => {
  const user = requireUser(); const recipientEmail = normalizeInviteEmail(email);
  if (recipientEmail === user.email.toLowerCase()) throw new Error('Escolha outra pessoa. Sua setlist já está na sua conta.');
  const published = await publishSetlist(list);
  sameUser(user.uid);
  const ref = doc(firestore, 'wmInvites', `${published.shareId}__${recipientEmail}`);
  await runTransaction(firestore, async transaction => {
    const previous = await transaction.get(ref); sameUser(user.uid);
    const existing = previous.exists() ? readInvite(ref.id, previous.data()) : null;
    if (!existing || existing.status === 'declined') {
      const preference = await transaction.get(doc(firestore, 'wmInvitePreferences', recipientEmail));
      sameUser(user.uid);
      if (preference.exists() && preference.data().acceptsInvites === false) throw new Error('Esta pessoa não está recebendo novos convites de setlists.');
    }
    transaction.set(ref, {
      shareId: published.shareId, senderUid: user.uid, senderName: user.name || 'Músico', senderPhoto: user.photo || '',
      recipientEmail, name: list.name, itemCount: published.count, offeredVersion: published.version,
      acceptedVersion: existing?.acceptedVersion ?? 0, declinedVersion: 0,
      status: existing?.status === 'accepted' ? 'accepted' : 'pending', updatedAt: now(),
      ...(existing?.recipientUid ? { recipientUid: existing.recipientUid } : {}),
    });
  });
};
export const updateSharedSetlist = async (list: Setlist): Promise<number> => {
  const user = requireUser(); const published = await publishSetlist(list);
  const invites = await getDocsFromServer(query(collection(firestore, 'wmInvites'), where('senderUid', '==', user.uid), where('shareId', '==', published.shareId)));
  for (let index = 0; index < invites.docs.length; index += 400) {
    sameUser(user.uid); const batch = writeBatch(firestore);
    for (const invite of invites.docs.slice(index, index + 400)) batch.update(invite.ref, { name: list.name, itemCount: published.count, offeredVersion: published.version, senderName: user.name || 'Músico', senderPhoto: user.photo || '', updatedAt: now() });
    await batch.commit();
  }
  return published.version;
};
/** Directory invitations target a UID; no recipient email is read or published. */
export const sendMusicianSetlistInvite = async (list: Setlist, recipientUid: string): Promise<void> => {
  const user = requireUser();
  if (!recipientUid || recipientUid === user.uid || recipientUid.includes('/')) throw new Error('Escolha outro músico para convidar.');
  const published = await publishSetlist(list); sameUser(user.uid);
  const ref = doc(firestore, 'wmInvites', `${published.shareId}__uid_${recipientUid}`);
  await runTransaction(firestore, async transaction => {
    const previous = await transaction.get(ref);
    const profile = await transaction.get(doc(firestore, 'wmMusicians', recipientUid)); sameUser(user.uid);
    if (!profile.exists()) throw new Error('Este músico retirou o perfil da busca.');
    const musician = readPublicMusician(recipientUid, profile.data());
    if (!musician.acceptsInvites) throw new Error('Esta pessoa não está recebendo novos convites de setlists.');
    const existing = previous.exists() ? readInvite(ref.id, previous.data()) : null;
    transaction.set(ref, {
      shareId: published.shareId, senderUid: user.uid, senderName: user.name || 'Músico', senderPhoto: user.photo || '',
      recipientEmail: '', recipientUid, recipientName: musician.name, name: list.name, itemCount: published.count,
      offeredVersion: published.version, acceptedVersion: existing?.acceptedVersion ?? 0, declinedVersion: 0,
      status: existing?.status === 'accepted' ? 'accepted' : 'pending', updatedAt: now(),
    });
  });
};
export const sentSetlistInvites = async (listId: string): Promise<SetlistInvite[]> => {
  const user = requireUser();
  const result = await getDocsFromServer(query(collection(firestore, 'wmInvites'), where('senderUid', '==', user.uid), where('shareId', '==', shareIdFor(user.uid, listId))));
  return result.docs.map(item => readInvite(item.id, item.data()));
};
export const downloadSharedVersion = async (invite: SetlistInvite): Promise<SharedSetlist> => {
  const user = requireUser();
  if (!isInviteRecipient(invite, user.uid, user.email)) throw new Error('Este convite pertence a outra conta.');
  const [header, snapshot] = await Promise.all([
    getDocFromServer(doc(firestore, 'wmShares', invite.shareId, 'versions', String(invite.offeredVersion))),
    getDocsFromServer(query(collection(firestore, 'wmShares', invite.shareId, 'versions', String(invite.offeredVersion), 'items'), orderBy('order'))),
  ]);
  sameUser(user.uid);
  if (!header.exists()) throw new Error('Esta versão do repertório não está disponível.');
  const meta = header.data();
  if (meta.ownerUid !== invite.senderUid || meta.version !== invite.offeredVersion || meta.itemCount !== snapshot.size) throw new Error('O repertório recebido está incompleto. Tente novamente.');
  const items = snapshot.docs.map((item, order): SharedItem => {
    const data = item.data() as SharedItem;
    const content = checkedPersonalChart(data);
    if (typeof data.id !== 'string' || data.order !== order || snapshot.size > 100) throw new Error('A ordem do repertório recebido é inválida.');
    checkedSetlist({ id: invite.shareId, name: meta.name, items: [{ id: data.id, songId: content.song.id, targetKey: data.targetKey, transpose: data.transpose, note: data.note }] });
    return cleanWire({ ...content, id: data.id, order, targetKey: data.targetKey, transpose: data.transpose, note: data.note });
  });
  return { id: invite.shareId, inviteId: invite.id, ownerUid: invite.senderUid, ownerName: String(meta.ownerName || invite.senderName), ownerPhoto: String(meta.ownerPhoto || invite.senderPhoto || ''), name: String(meta.name), version: invite.offeredVersion, items, updatedAt: now() };
};
export const acceptSetlistInvite = async (invite: SetlistInvite): Promise<void> => {
  const user = requireUser(); const local = db;
  const snapshot = await downloadSharedVersion(invite);
  await runTransaction(firestore, async transaction => {
    sameUser(user.uid); const ref = doc(firestore, 'wmInvites', invite.id); const current = await transaction.get(ref);
    if (!current.exists() || current.data().offeredVersion !== invite.offeredVersion) throw new Error('O convite foi atualizado. Feche e abra novamente as notificações.');
    transaction.update(ref, { status: 'accepted', recipientUid: user.uid, acceptedVersion: invite.offeredVersion, updatedAt: now() });
  });
  sameUser(user.uid); await local.sharedSetlists.put(snapshot); notifyLibraryChanged();
};
export const restoreAcceptedSetlist = async (invite: SetlistInvite): Promise<void> => {
  const user = requireUser(); const local = db;
  if (invite.status !== 'accepted' || invite.acceptedVersion < 1) throw new Error('Aceite o convite antes de baixar.');
  // Restore the accepted version, including when the latest update was refused.
  const snapshot = await downloadSharedVersion({ ...invite, offeredVersion: invite.acceptedVersion });
  sameUser(user.uid); await local.sharedSetlists.put(snapshot); notifyLibraryChanged();
};
export const declineSetlistInvite = async (invite: SetlistInvite): Promise<void> => {
  const user = requireUser();
  await runTransaction(firestore, async transaction => {
    const ref = doc(firestore, 'wmInvites', invite.id); const current = await transaction.get(ref); sameUser(user.uid);
    if (!current.exists() || current.data().offeredVersion !== invite.offeredVersion) throw new Error('Este convite mudou. Abra as notificações novamente.');
    transaction.update(ref, { status: current.data().status === 'accepted' ? 'accepted' : 'declined', recipientUid: user.uid, declinedVersion: invite.offeredVersion, updatedAt: now() });
  });
};
export { invitationNeedsAction };
