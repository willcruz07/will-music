import { AudioLines, Moon, Sun } from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';
import { Link, Route, Routes } from 'react-router';
import { BottomNav, TopNav } from './components/AppNav.tsx';
import { applyThemePref, isDark, useThemePref } from './lib/theme.ts';
import { Library } from './pages/Library.tsx';
import { IconButton } from './ui/Button.tsx';

// The library opens first; every other screen (and its heavy libraries) loads on demand.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, name: K) =>
  lazy(async () => ({ default: (await load())[name] }));
const NewSong = named(() => import('./pages/NewSong.tsx'), 'NewSong');
const Song = named(() => import('./pages/Song.tsx'), 'Song');
const EditChart = named(() => import('./pages/EditChart.tsx'), 'EditChart');
const Setlists = named(() => import('./pages/Setlists.tsx'), 'Setlists');
const SetlistEdit = named(() => import('./pages/SetlistEdit.tsx'), 'SetlistEdit');
const Settings = named(() => import('./pages/Settings.tsx'), 'Settings');
const Stage = named(() => import('./pages/Stage.tsx'), 'Stage');

// Reads the saved preference, never the <html> class (the stage forces dark while it is open).
export const ThemeToggle = () => {
  const [pref, setPref] = useThemePref();
  const dark = isDark(pref);
  useEffect(() => applyThemePref(), [pref]);
  return (
    <IconButton label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setPref(dark ? 'light' : 'dark')}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </IconButton>
  );
};

const Loading = () => <div className="mt-16 h-1 w-24 animate-pulse rounded-full bg-primary/40" aria-label="Carregando" />;

export const App = () => (
  <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/palco/lista/:id" element={<Stage mode="list" />} />
      <Route path="/palco/musica/:id" element={<Stage mode="song" />} />
      <Route path="*" element={<Layout />} />
    </Routes>
  </Suspense>
);

const Layout = () => (
  <div className="flex min-h-dvh flex-col">
    <header className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link to="/" className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <AudioLines className="size-5" />
          </span>
          will-music
        </Link>
        <div className="flex items-center gap-2">
          <TopNav />
          <ThemeToggle />
        </div>
      </div>
    </header>
    <main className="pb-nav mx-auto w-full max-w-5xl flex-1 px-4 pt-6">
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/nova" element={<NewSong />} />
          <Route path="/musica/:id" element={<Song />} />
          <Route path="/musica/:id/editar" element={<EditChart />} />
          <Route path="/listas" element={<Setlists />} />
          <Route path="/listas/:id" element={<SetlistEdit />} />
          <Route path="/ajustes" element={<Settings />} />
        </Routes>
      </Suspense>
    </main>
    <BottomNav />
  </div>
);
