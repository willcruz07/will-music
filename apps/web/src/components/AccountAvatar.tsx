import { UserRound } from 'lucide-react';
import { useState } from 'react';
import type { AccountUser } from '../lib/account.ts';

export const AccountAvatar = ({ user, className = 'size-10' }: { user: AccountUser | null; className?: string }) => {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = user?.photo && /^https:\/\//iu.test(user.photo) ? user.photo : null;
  const initials = user?.name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <span aria-hidden className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 font-semibold text-chord`}>
    {photo && failed !== photo ? <img src={photo} alt="" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setFailed(photo)} /> : initials ? <span className="text-sm">{initials}</span> : <UserRound className="size-5" />}
  </span>;
};
