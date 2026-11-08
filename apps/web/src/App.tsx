import { Moon, Sun } from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';
import { Link, Route, Routes } from 'react-router';
import { BottomNav, SettingsLink, TopNav } from './components/AppNav.tsx';
import { InstallBanner, UpdateBanner } from './components/PwaPrompts.tsx';
import { useAutoHideBars } from './lib/scrollBars.ts';
import { applyThemePref, isDark, useThemePref } from './lib/theme.ts';
import { Library } from './pages/Library.tsx';
import { DialogHost } from './ui/Dialog.tsx';
import { APP_VERSION, versionLabel } from './version.ts';
import { useWakeLock } from './lib/wakeLock.ts';
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
const Scores = named(() => import('./pages/Scores.tsx'), 'Scores');
const SongScore = named(() => import('./pages/SongScore.tsx'), 'SongScore');
const FolderPage = named(() => import('./pages/FolderPage.tsx'), 'FolderPage');
const StoragePage = named(() => import('./pages/StoragePage.tsx'), 'StoragePage');
const StudyPage = named(() => import('./pages/StudyPage.tsx'), 'StudyPage');
const StudyHome = named(() => import('./pages/StudyHome.tsx'), 'StudyHome');
const TrackPage = named(() => import('./pages/StudyHome.tsx'), 'TrackPage');
const LessonPage = named(() => import('./pages/StudyHome.tsx'), 'LessonPage');
const MicPage = named(() => import('./pages/MicPage.tsx'), 'MicPage');
const ConstellationPage = named(() => import('./pages/ConstellationPage.tsx'), 'ConstellationPage');
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

/** The screen stays on while the app is open (reading a chart, practicing, on stage). */
const KeepAwake = () => {
  useWakeLock(true);
  return null;
};

export const App = () => (
  <Suspense fallback={<Loading />}>
    <KeepAwake />
    <Routes>
      <Route path="/palco/lista/:id" element={<Stage mode="list" />} />
      <Route path="/palco/musica/:id" element={<Stage mode="song" />} />
      <Route path="*" element={<Layout />} />
    </Routes>
    <DialogHost />
  </Suspense>
);

const Layout = () => {
  useAutoHideBars();
  return (
  <div className="flex min-h-dvh flex-col">
    <header className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link to="/" className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          <img src={`${import.meta.env.BASE_URL}icons/mark-96.png`} alt="" width={32} height={32} className="size-8 rounded-lg" />
          {/* The name with the version right under it, in one block. */}
          <span className="flex flex-col leading-none">
            <span>will-music</span>
            <span className="mt-1 font-sans text-[10px] font-semibold tracking-normal text-muted-foreground" title={`Versão ${APP_VERSION}`}>
              {versionLabel()}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <TopNav />
          <SettingsLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
    <InstallBanner />
    <main className="pb-nav mx-auto w-full max-w-5xl flex-1 px-4 pt-6">
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/nova" element={<NewSong />} />
          <Route path="/musica/:id" element={<Song />} />
          <Route path="/musica/:id/editar" element={<EditChart />} />
          <Route path="/musica/:id/partitura" element={<SongScore />} />
          <Route path="/partituras" element={<Scores />} />
          <Route path="/pasta" element={<FolderPage />} />
          <Route path="/microfone" element={<MicPage />} />
          <Route path="/estudo" element={<StudyHome />} />
          <Route path="/estudo/ferramentas" element={<StudyPage />} />
          <Route path="/estudo/constelacao" element={<ConstellationPage />} />
          <Route path="/estudo/trilha/:id" element={<TrackPage />} />
          <Route path="/estudo/aula/:id" element={<LessonPage />} />
          <Route path="/armazenamento" element={<StoragePage />} />
          <Route path="/listas" element={<Setlists />} />
          <Route path="/listas/:id" element={<SetlistEdit />} />
          <Route path="/ajustes" element={<Settings />} />
        </Routes>
      </Suspense>
    </main>
    <BottomNav />
    <UpdateBanner />
  </div>
  );
};
