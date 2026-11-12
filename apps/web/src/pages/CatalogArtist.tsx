import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { CatalogBrowser } from '../components/CatalogBrowser.tsx';
import type { CatalogArtist as Artist } from '../lib/catalogData.ts';
import { Button } from '../ui/Button.tsx';

export const CatalogArtist = () => {
  const { artistId = '' } = useParams();
  const [params] = useSearchParams();
  const requested = params.get('voltar') || '';
  const back = requested.startsWith('/?aba=catalogo') ? requested : '/?aba=catalogo&por=artista';
  const [artist, setArtist] = useState<Artist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setArtist(null); setError(null);
    void (async () => {
      let message = (e: unknown) => e instanceof Error ? e.message : 'Não foi possível abrir o artista.';
      try { const api = await import('../lib/cloud/catalog.ts'); message = api.catalogError; const item = await api.getCatalogArtist(artistId); if (active) setArtist(item); }
      catch (e) { if (active) setError(message(e)); }
    })();
    return () => { active = false; };
  }, [artistId, revision]);
  return <section><Link to={back} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" /> Artistas</Link>
    {error ? <div role="alert" className="mt-5 rounded-2xl border border-border bg-surface p-5"><p>{error}</p><Button variant="outline" className="mt-3" onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button></div> : artist ? <CatalogBrowser key={artistId} artist={artist} /> : <div role="status" className="mt-5 animate-pulse rounded-2xl border border-border bg-surface p-5">Preparando as cifras do artista…</div>}
  </section>;
};
