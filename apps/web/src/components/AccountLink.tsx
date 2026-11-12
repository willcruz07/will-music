import { Link } from 'react-router';
import { useAccount } from '../lib/account.ts';
import { AccountAvatar } from './AccountAvatar.tsx';

export const AccountLink = () => {
  const { user, profileStatus } = useAccount();
  return <Link to="/conta" aria-label={user ? 'Minha conta' : 'Entrar na conta'} title={user ? user.name || user.email || 'Minha conta' : 'Entrar'} className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:ring-2 hover:ring-primary/30"><AccountAvatar user={user} />{profileStatus === 'error' && <span className="absolute right-0 top-0 size-2.5 rounded-full bg-amber-500 ring-2 ring-background" title="Perfil pendente de sincronização"><span className="sr-only">Perfil pendente de sincronização</span></span>}</Link>;
};
