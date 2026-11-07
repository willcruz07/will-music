import { Library, ListMusic, Settings } from 'lucide-react';
import { NavLink } from 'react-router';

const LINKS = [
  { to: '/', label: 'Biblioteca', icon: Library, end: true },
  { to: '/listas', label: 'Listas', icon: ListMusic, end: false },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, end: false },
];

export const TopNav = () => (
  <nav className="hidden items-center gap-1 sm:flex" aria-label="Principal">
    {LINKS.map(({ to, label, end }) => (
      <NavLink key={to} to={to} end={end} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-muted font-semibold' : 'text-muted-foreground hover:text-foreground'}`}>
        {label}
      </NavLink>
    ))}
  </nav>
);

export const BottomNav = () => (
  <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Principal">
    {LINKS.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'font-semibold text-chord' : 'text-muted-foreground'}`}>
        <Icon className="size-5" /> {label}
      </NavLink>
    ))}
  </nav>
);
