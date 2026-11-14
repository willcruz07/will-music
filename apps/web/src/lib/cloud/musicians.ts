import { collection, doc, getDocFromServer, getDocsFromServer, getFirestore, limit, orderBy, query, startAfter, where, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { cloudApp, cloudAuth } from './firebase.ts';
import { getAccountState } from '../account.ts';
import { musicianTag, normalizeMusicianName, readPublicMusician, type MusicianFilters, type PublicMusician } from '../musicians.ts';

const firestore = getFirestore(cloudApp);
const requireSession = () => {
  const uid = getAccountState().user?.uid;
  if (!uid || cloudAuth.currentUser?.uid !== uid) throw new Error('Sua sessão mudou. Entre novamente.');
  if (!navigator.onLine) throw new Error('Conecte-se para encontrar músicos e consultar os perfis publicados.');
  return uid;
};
const confirm = (uid: string) => { if (uid !== requireSession()) throw new Error('A conta mudou durante a consulta.'); };
export type MusicianPage = { items: PublicMusician[]; cursor: QueryDocumentSnapshot | null; more: boolean };
export const musicianQueryFilters = (filters: MusicianFilters): QueryConstraint[] => {
  const result: QueryConstraint[] = [];
  if (filters.region) {
    result.push(where('location.country', '==', 'Brasil'), where('location.region', '==', filters.region));
    if (filters.city) result.push(where('location.city', '==', filters.city));
  }
  const tag = musicianTag(filters.instrument, filters.style);
  if (tag) result.push(where('tags', 'array-contains', tag));
  const prefix = normalizeMusicianName(filters.name || '').slice(0, 90);
  if (prefix) result.push(where('searchName', '>=', prefix), where('searchName', '<=', prefix + '\uf8ff'));
  return result;
};
export const listMusicians = async (filters: MusicianFilters, cursor?: QueryDocumentSnapshot | null): Promise<MusicianPage> => {
  const uid = requireSession();
  const constraints = [...musicianQueryFilters(filters), orderBy('searchName')];
  if (cursor) constraints.push(startAfter(cursor));
  const result = await getDocsFromServer(query(collection(firestore, 'wmMusicians'), ...constraints, limit(20)));
  confirm(uid);
  return { items: result.docs.map(item => readPublicMusician(item.id, item.data())), cursor: result.docs.at(-1) ?? null, more: result.size === 20 };
};
export const getMusician = async (uid: string): Promise<PublicMusician | null> => {
  const accountUid = requireSession();
  const result = await getDocFromServer(doc(firestore, 'wmMusicians', uid)); confirm(accountUid);
  return result.exists() ? readPublicMusician(result.id, result.data()) : null;
};
export const musiciansError = (error: unknown): string => {
  console.error('Consulta de músicos falhou', error);
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && code.includes('permission-denied')) return 'O diretório de músicos ainda precisa ser autorizado nas regras do Firebase.';
  if (typeof code === 'string' && code.includes('failed-precondition')) return 'Este filtro precisa de um índice no Firebase. O console mostra o link de criação; você pode limpar os filtros enquanto ele é configurado.';
  return error instanceof Error ? error.message : 'Não foi possível carregar os músicos. Tente novamente.';
};
