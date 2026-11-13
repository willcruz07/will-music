import { useEffect, useState, type ReactNode } from 'react';
import { useAccount } from '../lib/account.ts';
import { selectAccountLibrary } from '../lib/db.ts';
import { Button } from '../ui/Button.tsx';

export const AccountLibrary = ({ children }: { children: ReactNode }) => {
  const { user } = useAccount();
  const [opened, setOpened] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true; let stop = () => {};
    setError(null);
    void selectAccountLibrary(user.uid).then(async () => {
      if (!active) return;
      const [{ startPersonalSync }, { startFolderAutoSync }, { startMusicianProfileSync }] = await Promise.all([import('../lib/cloud/personalSync.ts'), import('../lib/folder.ts'), import('../lib/musicianProfileStore.ts')]);
      if (!active) return;
      startFolderAutoSync();
      const stopLibrary = startPersonalSync(user); const stopProfile = startMusicianProfileSync(user.uid);
      stop = () => { stopLibrary(); stopProfile(); };
      setOpened(user.uid);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Não foi possível abrir a biblioteca desta conta.'); });
    return () => { active = false; stop(); };
  }, [user?.uid, retry]);
  if (error) return <div className="mx-auto max-w-lg p-6"><p role="alert">{error}</p><Button className="mt-4" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></div>;
  if (!user || opened !== user.uid) return <p role="status" className="p-6 text-sm text-muted-foreground">Abrindo a biblioteca da sua conta…</p>;
  return children;
};
