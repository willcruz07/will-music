import { GraduationCap, Library, ListMusic, Mic, Music4, Plus, Settings } from 'lucide-react';
import { Link, NavLink } from 'react-router';

type Item = { to: string; label: string; icon: typeof Library; end: boolean };

const ITEMS: Item[] = [
  { to: '/', label: 'Biblioteca', icon: Library, end: true },
  { to: '/listas', label: 'Listas', icon: ListMusic, end: false },
  { to: '/partituras', label: 'Partituras', icon: Music4, end: false },
  { to: '/estudo', label: 'Estudo', icon: GraduationCap, end: false },
];
const MIC: Item = { to: '/microfone', label: 'Microfone', icon: Mic, end: false };
const SETTINGS: Item = { to: '/ajustes', label: 'Ajustes', icon: Settings, end: false };

/** Settings live in the header on phones (the bottom bar keeps the four main places). */
export const SettingsLink = () => (
  <NavLink to="/ajustes" aria-label="Ajustes" title="Ajustes" className={({ isActive }) => `inline-flex size-10 items-center justify-center rounded-lg hover:bg-muted md:hidden ${isActive ? 'text-chord' : 'text-foreground'}`}>
    <Settings className="size-5" />
  </NavLink>
);

export const TopNav = () => (
  <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
    {[...ITEMS, MIC, SETTINGS].map(({ to, label, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        className={({ isActive }) =>
          `rounded-full px-4 py-2 text-sm transition-colors ${isActive ? 'bg-surface-2 font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`
        }
      >
        {label}
      </NavLink>
    ))}
    <Link to="/nova" className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
      <Plus className="size-4" /> Adicionar
    </Link>
  </nav>
);

const Tab = ({ item }: { item: Item }) => {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `group relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${isActive ? 'font-semibold text-chord' : 'text-muted-foreground'}`}
    >
      {({ isActive }) => (
        <>
          <Icon className={`size-[22px] transition-transform ${isActive ? 'scale-110' : 'group-active:scale-95'}`} />
          {item.label}
          {isActive && <span className="absolute -top-0.5 h-1 w-6 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />}
        </>
      )}
    </NavLink>
  );
};

/** Floating pill on phones and tablets, with the main action (add a song) raised in the middle. */
export const BottomNav = () => (
  <nav
    aria-label="Principal"
    className="glass-strong bar-slide fixed inset-x-3 z-30 flex h-[var(--nav-height)] items-center rounded-[1.75rem] border border-border px-2 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.45)] md:hidden"
    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
  >
    <Tab item={ITEMS[0]!} />
    <Tab item={ITEMS[1]!} />
    <Link
      to="/nova"
      aria-label="Adicionar música"
      className="mx-1 -mt-8 inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_var(--primary)] ring-4 ring-background active:scale-95"
    >
      <Plus className="size-7" />
    </Link>
    <Tab item={ITEMS[2]!} />
    <Tab item={ITEMS[3]!} />
  </nav>
);
