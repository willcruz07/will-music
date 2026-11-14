import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ uid: 'editor', authUid: 'editor', stored: {} as Record<string, unknown>, update: vi.fn(), transaction: vi.fn(), afterRead: null as (() => void) | null }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudApp: {}, cloudAuth: { get currentUser() { return { uid: fake.authUid }; } } }));
vi.mock('../src/lib/account.ts', () => ({ getAccountState: () => ({ user: { uid: fake.uid } }) }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => 'firestore', doc: (_: unknown, ...parts: string[]) => parts.join('/'),
  runTransaction: async (_: unknown, work: (transaction: unknown) => unknown) => {
    fake.transaction();
    return work({ get: async () => { fake.afterRead?.(); return { id: 'legacy', exists: () => true, data: () => fake.stored }; }, update: (ref: string, patch: Record<string, unknown>) => { fake.update(ref, patch); fake.stored = { ...fake.stored, ...patch }; } });
  },
}));
import { mapCatalogChart } from '../src/lib/catalogData.ts';
import { saveCatalogChordPro } from '../src/lib/cloud/catalog.ts';
beforeEach(() => {
  fake.uid = 'editor'; fake.authUid = 'editor'; fake.afterRead = null;
  fake.stored = { title: 'Cifra antiga', content: '{Intro}\n[C/E]Letra', artist: { name: 'Artista' }, style: 'mpb' };
  fake.update.mockClear(); fake.transaction.mockClear();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
describe('shared catalog ChordPro writes', () => {
  it('migrates an edited legacy chart into chordPro without overwriting content or metadata', async () => {
    const base = mapCatalogChart('legacy', fake.stored)!; const legacy = fake.stored.content;
    const result = await saveCatalogChordPro(base, '{comment: Intro}\n[Dm7]Letra nova');
    expect(fake.update).toHaveBeenCalledWith('cifras/legacy', { chordPro: '{comment: Intro}\n[Dm7]Letra nova' });
    expect(fake.stored.content).toBe(legacy); expect(fake.stored.style).toBe('mpb');
    expect(result.chordPro).toBe('{comment: Intro}\n[Dm7]Letra nova'); expect(result).not.toHaveProperty('content');
  });
  it('refuses to overwrite a newer edit, but accepts an idempotent retry', async () => {
    const base = mapCatalogChart('legacy', fake.stored)!;
    fake.stored.chordPro = '[G]Alteração de outra pessoa';
    await expect(saveCatalogChordPro(base, '[D]Meu rascunho')).rejects.toThrow('Outra pessoa alterou');
    expect(fake.update).not.toHaveBeenCalled();
    await saveCatalogChordPro(base, '[G]Alteração de outra pessoa');
    expect(fake.update).toHaveBeenCalledTimes(1);
  });
  it('does not write when offline, the session changes, or the draft is blank', async () => {
    const base = mapCatalogChart('legacy', fake.stored)!;
    await expect(saveCatalogChordPro(base, ' ')).rejects.toThrow('conteúdo');
    fake.authUid = 'other'; await expect(saveCatalogChordPro(base, '[D]Letra')).rejects.toThrow('sessão mudou');
    fake.authUid = fake.uid; fake.afterRead = () => { fake.authUid = 'other'; };
    await expect(saveCatalogChordPro(base, '[D]Letra')).rejects.toThrow('sessão mudou');
    expect(fake.update).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await expect(saveCatalogChordPro(base, '[D]Letra')).rejects.toThrow('Conecte-se');
  });
});
