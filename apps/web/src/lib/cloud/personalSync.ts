import Dexie, { type Transaction } from 'dexie';
import { useSyncExternalStore } from 'react';
import { collection, doc, getDocsFromServer, getFirestore, onSnapshot, runTransaction } from 'firebase/firestore';
import { cloudApp, cloudAuth } from './firebase.ts';
import { getAccountState, type AccountUser } from '../account.ts';
import { db, now, type Setlist } from '../db.ts';
import { checkedPersonalChart, checkedSetlist, cleanWire, fingerprint, notifyLibraryChanged, personalChart, stableWire, type CloudEntity, type PersonalChart } from '../sharingTypes.ts';

type Receipt = { revision: number; fingerprint: string };
type Receipts = Record<string, Receipt>;
type SyncState = { status: 'idle' | 'syncing' | 'offline' | 'error'; message?: string; lastAt?: string };
let state: SyncState = { status: 'idle' };
const listeners = new Set<() => void>();
const emit = (next: SyncState) => { state = next; listeners.forEach(listener => listener()); };
export const usePersonalSync = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state);
export const requestPersonalSync = () => window.dispatchEvent(new Event('wm-sync-now'));
const firestore = getFirestore(cloudApp);

/** Revisions are server-checked; simultaneous edits are preserved in a separate local copy. */
export const startPersonalSync = (user: AccountUser): (() => void) => {
  const local = db;
  let active = true; let busy = false; let rerun = false; let timer: ReturnType<typeof setTimeout>;
  const applying = new WeakSet<Transaction>();
  const valid = () => active && getAccountState().user?.uid === user.uid && cloudAuth.currentUser?.uid === user.uid;
  const assert = () => { if (!valid()) throw new DOMException('A conta mudou.', 'AbortError'); };
  const readChart = async (id: string): Promise<PersonalChart | null> => {
    const song = await local.songs.get(id);
    const chart = await local.charts.where('songId').equals(id).first();
    if (!song || !chart || await local.audio.where('songId').equals(id).count()) return null;
    return personalChart(song, chart);
  };
  const read = async (kind: string, id: string) => kind === 'wmCharts' ? readChart(id) : (await local.setlists.get(id)) ?? null;
  const apply = async (kind: string, id: string, payload: PersonalChart | Setlist | null, expected: string, conflicting?: PersonalChart | Setlist) => {
    assert();
    return local.transaction('rw', local.songs, local.charts, local.audio, local.setlists, async () => {
      applying.add(Dexie.currentTransaction!);
      if (stableWire(await read(kind, id)) !== expected) return false;
      assert();
      if (kind === 'wmCharts' && await local.audio.where('songId').equals(id).count()) throw new Error('Uma cifra recebida coincide com um áudio local. A cópia local foi mantida.');
      // Preserve and replace atomically: failed writes cannot leave duplicate conflict copies.
      if (conflicting) await preserveCopy(kind, conflicting);
      if (kind === 'wmCharts') {
        if (payload) {
          const data = checkedPersonalChart(payload);
          if (data.song.id !== id) throw new Error('Identificação de cifra recebida inválida.');
          await local.songs.put(data.song);
          const previous = await local.charts.where('songId').equals(id).first();
          await local.charts.put({ ...data.chart, id: previous?.id ?? data.chart.id, songId: id });
        } else { await local.charts.where('songId').equals(id).delete(); await local.songs.delete(id); }
      } else if (payload) {
        const list = checkedSetlist(payload);
        if (list.id !== id) throw new Error('Identificação de setlist recebida inválida.');
        await local.setlists.put(list);
      } else await local.setlists.delete(id);
      return true;
    });
  };
  const preserveCopy = async (kind: string, payload: PersonalChart | Setlist) => {
    assert();
    const id = crypto.randomUUID(); const stamp = now();
    if (kind === 'wmCharts') {
      const data = checkedPersonalChart(payload);
      await local.transaction('rw', local.songs, local.charts, async () => {
        await local.songs.add({ ...data.song, id, title: `${data.song.title} (cópia deste aparelho)`, createdAt: stamp, updatedAt: stamp });
        await local.charts.add({ ...data.chart, id: crypto.randomUUID(), songId: id, createdAt: stamp, updatedAt: stamp });
      });
    } else {
      const data = checkedSetlist(payload);
      await local.setlists.add({ ...data, id, name: `${data.name} (cópia deste aparelho)`, createdAt: stamp, updatedAt: stamp });
    }
  };
  const sync = async () => {
    if (!valid()) return;
    if (busy) { rerun = true; return; }
    if (!navigator.onLine) { emit({ status: 'offline', message: 'Alterações guardadas neste aparelho. A sincronização continua quando houver conexão.' }); return; }
    busy = true; emit({ ...state, status: 'syncing', message: undefined });
    let changed = false; let conflict = false;
    try {
      const receipts = ((await local.settings.get('wm-cloud-receipts'))?.value ?? {}) as Receipts;
      for (const kind of ['wmCharts', 'wmSetlists']) {
        assert();
        const remote = await getDocsFromServer(collection(firestore, 'users', user.uid, kind));
        assert();
        const remoteMap = new Map(remote.docs.map(snapshot => {
          const value = snapshot.data() as CloudEntity;
          if (!Number.isInteger(value.revision) || value.revision < 1 || typeof value.deleted !== 'boolean') throw new Error('Formato de sincronização inválido no servidor.');
          if (!value.deleted) value.payload = kind === 'wmCharts' ? checkedPersonalChart(value.payload) : checkedSetlist(value.payload);
          return [decodeURIComponent(snapshot.id), value] as const;
        }));
        const localIds = kind === 'wmCharts' ? (await local.charts.toArray()).map(chart => chart.songId) : await local.setlists.toCollection().primaryKeys();
        const knownIds = Object.keys(receipts).filter(key => key.startsWith(`${kind}/`)).map(key => key.slice(kind.length + 1));
        for (const id of new Set([...localIds, ...knownIds, ...remoteMap.keys()])) {
          assert();
          const payload = await read(kind, id);
          const localWire = stableWire(payload);
          const localHash = await fingerprint(payload);
          const key = `${kind}/${id}`; const base = receipts[key]; const other = remoteMap.get(id);
          const otherPayload = other?.deleted ? null : other?.payload ?? null;
          const otherHash = await fingerprint(otherPayload);
          if (localHash === otherHash) { receipts[key] = { revision: other?.revision ?? 0, fingerprint: localHash }; continue; }
          const localChanged = base ? localHash !== base.fingerprint : payload !== null;
          const remoteChanged = base ? (other?.revision ?? 0) !== base.revision : !!other;
          if (remoteChanged) {
            if (!await apply(kind, id, otherPayload, localWire, localChanged && payload ? payload : undefined)) { rerun = true; continue; }
            if (localChanged && payload) { conflict = true; rerun = true; }
            receipts[key] = { revision: other?.revision ?? 0, fingerprint: otherHash }; changed = true;
          } else if (localChanged) {
            if (new TextEncoder().encode(localWire).length > 700000) throw new Error('Uma cifra ou setlist é grande demais para sincronizar. Reduza seu conteúdo e tente novamente.');
            const ref = doc(firestore, 'users', user.uid, kind, encodeURIComponent(id));
            const committed = await runTransaction(firestore, async transaction => {
              assert(); const snapshot = await transaction.get(ref);
              const revision = snapshot.exists() ? snapshot.data().revision as number : 0;
              if (revision !== (base?.revision ?? 0)) return null;
              const value: CloudEntity = { revision: revision + 1, deleted: payload === null, payload: cleanWire(payload) };
              transaction.set(ref, { ...value, updatedAt: now() });
              return value;
            });
            if (committed) receipts[key] = { revision: committed.revision, fingerprint: localHash };
            else rerun = true;
          }
          assert(); await local.settings.put({ key: 'wm-cloud-receipts', value: receipts });
        }
      }
      assert(); await local.settings.put({ key: 'wm-cloud-receipts', value: receipts });
      emit({ status: 'idle', lastAt: now(), message: conflict ? 'Houve edições em dois aparelhos. Uma cópia local foi preservada na biblioteca.' : undefined });
      if (changed || conflict) notifyLibraryChanged();
    } catch (error) {
      if (valid()) {
        console.error('Sincronização da biblioteca falhou', error);
        emit({ ...state, status: navigator.onLine ? 'error' : 'offline', message: 'Suas alterações continuam neste aparelho. Não foi possível sincronizar; confira a conexão e as regras do Firebase em docs/firebase-compartilhamento.md.' });
      }
    } finally {
      busy = false;
      if (rerun && valid()) { rerun = false; schedule(); }
    }
  };
  const schedule = () => { if (!active) return; clearTimeout(timer); timer = setTimeout(() => void sync(), 1200); };
  const hooks: (() => void)[] = [];
  for (const table of [local.songs, local.charts, local.setlists]) {
    const created = (_key: unknown, _value: unknown, tx: Transaction) => { if (!applying.has(tx)) tx.on('complete', schedule); };
    const updated = (_mods: unknown, _key: unknown, _value: unknown, tx: Transaction) => { if (!applying.has(tx)) tx.on('complete', schedule); };
    table.hook('creating', created); table.hook('updating', updated); table.hook('deleting', created);
    hooks.push(() => { table.hook('creating').unsubscribe(created); table.hook('updating').unsubscribe(updated); table.hook('deleting').unsubscribe(created); });
  }
  const watch = ['wmCharts', 'wmSetlists'].map(kind => onSnapshot(collection(firestore, 'users', user.uid, kind), schedule, error => {
    if (valid()) { console.warn('Atualizações da biblioteca indisponíveis', error); emit({ status: 'error', message: 'Não foi possível acompanhar a biblioteca online. Confira as regras do Firebase.' }); }
  }));
  window.addEventListener('online', schedule); window.addEventListener('wm-sync-now', schedule);
  void sync();
  return () => { active = false; clearTimeout(timer); hooks.forEach(stop => stop()); watch.forEach(stop => stop()); window.removeEventListener('online', schedule); window.removeEventListener('wm-sync-now', schedule); emit({ status: 'idle' }); };
};
