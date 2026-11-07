import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router';
import { BottomNav, TopNav } from './components/AppNav.tsx';
import { EditChart } from './pages/EditChart.tsx';
import { SetlistEdit } from './pages/SetlistEdit.tsx';
import { Setlists } from './pages/Setlists.tsx';
import { Stage } from './pages/Stage.tsx';
import { Library } from './pages/Library.tsx';
import { NewSong } from './pages/NewSong.tsx';
import { Song } from './pages/Song.tsx';
import { IconButton } from './ui/Button.tsx';

const THEME_KEY = 'wm-theme';

const initialDark = (): boolean => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === 'dark';
  } catch {
    // storage unavailable
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
};

export const ThemeToggle = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark') || initialDark());
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
      // storage unavailable
    }
  }, [dark]);
  return (
    <IconButton label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => setDark((d) => !d)}>
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </IconButton>
  );
};

export const App = () => (
  <Routes>
    <Route path="/palco/lista/:id" element={<Stage mode="list" />} />
    <Route path="/palco/musica/:id" element={<Stage mode="song" />} />
    <Route path="*" element={<Layout />} />
  </Routes>
);

const Layout = () => (
  <div className="flex min-h-dvh flex-col">
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          will-music
        </Link>
        <div className="flex items-center gap-2">
          <TopNav />
          <ThemeToggle />
        </div>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-40 pt-6">
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/nova" element={<NewSong />} />
        <Route path="/musica/:id" element={<Song />} />
        <Route path="/musica/:id/editar" element={<EditChart />} />
        <Route path="/listas" element={<Setlists />} />
        <Route path="/listas/:id" element={<SetlistEdit />} />
      </Routes>
    </main>
    <BottomNav />
  </div>
);
