import { useEffect, useRef, useState } from 'react';
import { useAccount } from './account.ts';
import { catalogProject, type CatalogChart } from './catalogData.ts';
import { normalizeChordPro } from './communityCatalog.ts';
import { db, now, type Song } from './db.ts';
import { useOnline } from './online.ts';

/**
 * Where an edited chart goes when saved:
 * - local: only the musician's library (default, works offline);
 * - option: a new community option of the catalog chart it came from (the main chart is never changed);
 * - main: the creator correcting their own public chart while nobody else has sent options;
 * - public: a chart that is not in the catalog yet, published there signed by the musician.
 */
export type PublicationMode = 'local' | 'option' | 'main' | 'public';

export const useCatalogPublication = (song: Song | null | undefined, enabled: boolean) => {
  const online = useOnline();
  const { user } = useAccount();
  const source = song?.catalogSource;
  const fromCatalog = !!source && source.project === catalogProject && source.collection === 'cifras';
  const [mode, setMode] = useState<PublicationMode>('local');
  const [style, setStyle] = useState('');
  const [base, setBase] = useState<CatalogChart | null>(null);
  const [canEditMain, setCanEditMain] = useState(false);
  const lock = useRef(false);
  useEffect(() => { if (enabled) setMode('local'); }, [enabled, source?.id]);
  // Whether "correct my public chart" is offered: from the session cache when the chart was just opened (no read).
  useEffect(() => {
    if (!enabled || !fromCatalog || !online || !user) { setBase(null); setCanEditMain(false); return; }
    let active = true;
    void import('./cloud/catalog.ts').then(async api => {
      try { const chart = await api.getCatalogChart(source!.id); if (active) { setBase(chart); setCanEditMain(api.canEditOwnPublicChart(chart, user.uid)); } }
      catch { if (active) { setBase(null); setCanEditMain(false); } }
    });
    return () => { active = false; };
  }, [enabled, fromCatalog, source?.id, online, user?.uid]);

  const choices: PublicationMode[] = !user ? ['local'] : fromCatalog ? (canEditMain ? ['local', 'option', 'main'] : ['local', 'option']) : ['local', 'public'];
  const remote = mode !== 'local';
  const missing = mode === 'public' ? (!song?.artist?.trim() ? 'Informe o artista da música antes de publicar.' : !style.trim() ? 'Informe o estilo para publicar.' : null) : null;
  const error = remote && !online ? 'Conecte-se para enviar ao catálogo, ou escolha salvar só na sua biblioteca.' : missing;

  const save = async (text: string, localSave: () => Promise<void>) => {
    if (lock.current) throw new Error('Aguarde o salvamento atual.');
    lock.current = true;
    try {
      if (!remote || !song) { await localSave(); return; }
      if (error) throw new Error(error);
      const api = await import('./cloud/catalog.ts');
      let link: Song['catalogSource'] | undefined;
      try {
        if (mode === 'option' && source) {
          const prefix = `${user!.uid}_`;
          const replaceId = source.optionKey?.startsWith(prefix) ? source.optionKey.slice(prefix.length) : undefined;
          const chart = await api.submitCatalogOption(source.id, text, replaceId);
          setBase(chart);
          const target = normalizeChordPro(text);
          const sent = chart.options.find(o => o.author.uid === user!.uid && normalizeChordPro(o.chordPro) === target);
          if (sent) link = { ...source, optionKey: sent.key };
        } else if (mode === 'main' && source) {
          setBase(await api.updateOwnPublicChart(source.id, text));
        } else if (mode === 'public') {
          const chart = await api.createPublicChart({ title: song.title, artist: song.artist, style, key: song.key, chordPro: text });
          link = { project: catalogProject, collection: 'cifras', id: chart.id, savedAt: now() };
        }
      } catch (failure) {
        const code = (failure as { code?: unknown })?.code;
        if (typeof code === 'string' && code.includes('permission-denied')) throw new Error('O catálogo não autorizou este envio. Seu texto foi mantido; você pode salvar só na sua biblioteca.');
        throw failure instanceof Error && !code ? failure : new Error(api.catalogError(failure));
      }
      try {
        await localSave();
        if (link) await db.songs.update(song.id, { catalogSource: link, updatedAt: now() });
      } catch (failure) {
        throw new Error('O envio ao catálogo deu certo, mas não foi possível atualizar sua cópia local. O texto editado foi mantido; tente salvar de novo só na biblioteca.', { cause: failure });
      }
    } finally { lock.current = false; }
  };

  return { applicable: choices.length > 1, choices, mode, setMode, style, setStyle, base, error, blocked: remote && !!error, save };
};
