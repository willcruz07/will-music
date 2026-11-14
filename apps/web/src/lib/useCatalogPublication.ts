import { useEffect, useRef, useState } from 'react';
import { catalogProject, type CatalogChart } from './catalogData.ts';
import type { Song } from './db.ts';
import { useOnline } from './online.ts';

export const useCatalogPublication = (source: Song['catalogSource'], enabled: boolean) => {
  const online = useOnline(); const validSource = !!source && source.project === catalogProject && source.collection === 'cifras';
  const [publish, setPublish] = useState(true); const [base, setBase] = useState<CatalogChart | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0); const lock = useRef(false);
  useEffect(() => { if (enabled) setPublish(true); }, [enabled, source?.id]);
  useEffect(() => {
    if (!enabled || !validSource) return;
    let active = true; setBase(null); setError(null);
    if (!online) { setError('Conecte-se para atualizar também o catálogo. Você pode desmarcar essa opção e salvar somente na biblioteca.'); setLoading(false); return; }
    setLoading(true);
    void import('./cloud/catalog.ts').then(async api => {
      try { const value = await api.getCatalogChart(source!.id, true); if (active) setBase(value); }
      catch (error) { if (active) setError(api.catalogError(error)); }
    }).catch(() => { if (active) setError('Não foi possível carregar a referência do catálogo.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [source?.id, source?.project, enabled, online, revision]);
  const save = async (text: string, localSave: () => Promise<void>) => {
    if (lock.current) throw new Error('Aguarde o salvamento atual.');
    lock.current = true;
    let published = false;
    try {
      if (validSource && publish) {
        if (!online || !base || base.id !== source?.id || loading) throw new Error('Aguarde a referência do catálogo ou salve somente na biblioteca.');
        const api = await import('./cloud/catalog.ts');
        try { const updated = await api.saveCatalogChordPro(base, text); setBase(updated); published = true; }
        catch (error) { const code = (error as { code?: unknown })?.code; if (typeof code === 'string' && code.includes('permission-denied')) throw new Error('Seu perfil não tem permissão para editar o catálogo compartilhado. O texto foi mantido; você pode salvar somente na biblioteca desmarcando a opção de atualizar o catálogo.'); throw new Error(api.catalogError(error)); }
      }
      try { await localSave(); }
      catch (error) { if (published) throw new Error('O catálogo foi atualizado, mas não foi possível atualizar sua cópia local. O texto editado foi mantido; tente salvar novamente.', { cause: error }); throw error; }
    } finally { lock.current = false; }
  };
  return { applicable: validSource, publish, setPublish, base, loading, error, needsMigration: validSource && publish && base?.sourceField === 'content', blocked: validSource && publish && (!online || loading || !base || base.id !== source?.id), reload: () => setRevision(value => value + 1), save };
};
