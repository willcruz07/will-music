import { Moon, Sun } from 'lucide-react';
import { Suspense, lazy, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router';
import { BottomNav, SettingsLink, TopNav } from './components/AppNav.tsx';
import { ModelsSetup } from './components/ModelsSetup.tsx';
import { InstallBanner, UpdateBanner } from './components/PwaPrompts.tsx';
import { useAutoHideBars } from './lib/scrollBars.ts';
import { applyThemePref, isDark, useThemePref } from './lib/theme.ts';
import { Library } from './pages/Library.tsx';
import { DialogHost } from './ui/Dialog.tsx';
import { APP_VERSION, versionLabel } from './version.ts';
import { useWakeLock } from './lib/wakeLock.ts';
import { IconButton } from './ui/Button.tsx';
import { useStudioLayout } from './lib/studioLayout.ts';
import { AccountLink } from './components/AccountLink.tsx';
import { RequireAccount } from './components/RequireAccount.tsx';
import { RouteScrollReset } from './components/RouteScrollReset.tsx';
import { NotificationsBell } from './components/NotificationsBell.tsx';
import { AccountLibrary } from './components/AccountLibrary.tsx';

// The library opens first; every other screen (and its heavy libraries) loads on demand.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, name: K) =>
  lazy(async () => ({ default: (await load())[name] }));
const NewSong = named(() => import('./pages/NewSong.tsx'), 'NewSong');
const Song = named(() => import('./pages/Song.tsx'), 'Song');
const SongRoute = () => { const { id } = useParams(); return <Song key={id} />; };
const EditChart = named(() => import('./pages/EditChart.tsx'), 'EditChart');
const Setlists = named(() => import('./pages/Setlists.tsx'), 'Setlists');
const SetlistEdit = named(() => import('./pages/SetlistEdit.tsx'), 'SetlistEdit');
const Settings = named(() => import('./pages/Settings.tsx'), 'Settings');
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
const Login = named(() => import('./pages/Login.tsx'), 'Login');
const Musicians = named(() => import('./pages/Musicians.tsx'), 'Musicians');
const Musician = named(() => import('./pages/Musician.tsx'), 'Musician');
const MusicianRoute = () => { const { id } = useParams(); return <Musician key={id} />; };
const CatalogChart = named(() => import('./pages/CatalogChart.tsx'), 'CatalogChart');
const CatalogChartRoute = () => { const { id } = useParams(); return <CatalogChart key={id} />; };
const CatalogArtist = named(() => import('./pages/CatalogArtist.tsx'), 'CatalogArtist');
const CatalogArtistRoute = () => { const { artistId } = useParams(); return <CatalogArtist key={artistId} />; };
const LegacySetlistRoute = () => { const { id } = useParams(); return <Navigate to={`/palco/repertorio/${id}`} replace />; };

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
  <>
  <RouteScrollReset />
  <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<RequireAccount><AccountLibrary><AuthenticatedApp /></AccountLibrary></RequireAccount>} />
    </Routes>
    <DialogHost />
  </Suspense>
  </>
);

const AuthenticatedApp = () => <>
    <KeepAwake />
    <Routes>
      <Route path="/palco/compartilhada/:id" element={<Stage mode="shared" />} />
      <Route path="/palco/lista/:id" element={<Stage mode="list" />} />
      <Route path="/palco/musica/:id" element={<Stage mode="song" />} />
      <Route path="*" element={<Layout />} />
    </Routes>
  </>;

const Layout = () => {
  useAutoHideBars();
  const studio = useStudioLayout();
  return (
  <div className={`${studio ? 'studio-layout ' : ''}flex min-h-dvh flex-col`}>
    <header hidden={studio} className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
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
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <TopNav />
          <SettingsLink /><NotificationsBell />
          <AccountLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
    {!studio && <InstallBanner />}
    <main className={`${studio ? 'max-w-7xl pb-28 pt-[calc(env(safe-area-inset-top)+1rem)]' : 'pb-nav max-w-5xl pt-6'} mx-auto w-full flex-1 px-4`}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/nova" element={<NewSong />} />
          <Route path="/musica/:id" element={<SongRoute />} />
          <Route path="/musica/:id/editar" element={<EditChart />} />
          <Route path="/musica/:id/partitura" element={<SongScore />} />
          <Route path="/partituras" element={<Navigate to="/?aba=partituras" replace />} />
          <Route path="/pasta" element={<FolderPage />} />
          <Route path="/microfone" element={<MicPage />} />
          <Route path="/estudo" element={<StudyHome />} />
          <Route path="/estudo/ferramentas" element={<StudyPage />} />
          <Route path="/estudo/constelacao" element={<ConstellationPage />} />
          <Route path="/estudo/trilha/:id" element={<TrackPage />} />
          <Route path="/estudo/aula/:id" element={<LessonPage />} />
          <Route path="/armazenamento" element={<StoragePage />} />
          <Route path="/palco" element={<Setlists />} />
          <Route path="/palco/repertorio/:id" element={<SetlistEdit />} />
          <Route path="/listas" element={<Navigate to="/palco" replace />} />
          <Route path="/listas/:id" element={<LegacySetlistRoute />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="/musicos" element={<Musicians />} />
          <Route path="/musicos/:id" element={<MusicianRoute />} />
          <Route path="/conta" element={<Login account />} />
          <Route path="/catalogo" element={<Navigate to="/?aba=catalogo" replace />} />
          <Route path="/catalogo/:id" element={<CatalogChartRoute />} />
          <Route path="/catalogo/artista/:artistId" element={<CatalogArtistRoute />} />
        </Routes>
      </Suspense>
    </main>
    {!studio && <BottomNav />}
    <UpdateBanner />
    <ModelsSetup />
  </div>
  );
};
