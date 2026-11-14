import { usePersonalSync, requestPersonalSync } from '../lib/cloud/personalSync.ts';
import { ArrowLeft, AudioLines, CloudOff, LoaderCircle, LogOut, Music2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { accountError, hasGoogleSession, leaveAccount, prepareGoogle, retryAccountProfile, startAccount, useAccount } from '../lib/account.ts';
import { useOnline } from '../lib/online.ts';
import { applyThemePref } from '../lib/theme.ts';
import { accountReturn } from '../components/RequireAccount.tsx';
import { Button } from '../ui/Button.tsx';
import { AccountAvatar } from '../components/AccountAvatar.tsx';
import { MusicianProfileEditor } from '../components/MusicianProfileEditor.tsx';

const GoogleMark = () => <svg viewBox="0 0 48 48" className="size-6 shrink-0" aria-hidden><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15.1Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.6 19.6 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z"/></svg>;

export const Login = ({ account = false }: { account?: boolean }) => {
  const { user, ready, error: sessionError, profileStatus, profileError } = useAccount();
  const online = useOnline();
  const sync = usePersonalSync();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [google, setGoogle] = useState<Awaited<ReturnType<typeof prepareGoogle>> | null>(null);
  useEffect(() => { applyThemePref(); }, []);
  useEffect(() => {
    let active = true;
    setGoogle(null); setPreparationError(null);
    void prepareGoogle().then(action => { if (active) setGoogle(() => action); }).catch(e => { if (active) setPreparationError(accountError(e)); });
    return () => { active = false; };
  }, [attempt]);
  if (!account && ready && hasGoogleSession(user)) return <Navigate to={accountReturn(params.get('voltar'))} replace />;

  const retry = () => { setError(null); setAttempt(value => value + 1); void startAccount(); };
  const failure = error || preparationError || sessionError;
  const signIn = async () => {
    if (!google || busy) return;
    setBusy(true); setError(null);
    try { await google(); } // The auth observer confirms the Google session before redirecting.
    catch (e) { setError(accountError(e)); }
    finally { setBusy(false); }
  };

  if (account && hasGoogleSession(user)) return <section className="mx-auto max-w-3xl">
    <Link to="/" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" /> Biblioteca</Link>
    <div className="mt-4 rounded-3xl border border-border bg-surface p-4 sm:p-8"><h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Minha conta</h1><div className="mt-5"><AccountAvatar user={user} className="size-16" /></div><p className="mt-3 break-words text-xl font-semibold">{user?.name || 'Sua conta Google'}</p><p className="mt-1 break-all text-sm text-muted-foreground">{user?.email}</p><p className="mt-4 text-sm text-muted-foreground">{online ? 'Conectado com Google neste aparelho.' : 'Sessão Google restaurada neste aparelho. Suas cifras salvas continuam disponíveis offline.'}</p>
    {profileStatus === 'pending' && <p role="status" className="mt-3 text-xs text-muted-foreground">Salvando seu perfil…</p>}
    {(profileStatus === 'error' || profileStatus === 'offline') && <div className="mt-4 rounded-xl border border-border p-3 text-sm"><p role="status">{profileError || 'Seu perfil será sincronizado quando a conexão voltar.'}</p><Button variant="outline" className="mt-2" disabled={!online} onClick={() => void retryAccountProfile()}>Tentar salvar perfil</Button></div>}
    <Link to="/musicos" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-chord">Encontrar outros músicos</Link>
    {user && <MusicianProfileEditor key={user.uid} uid={user.uid} initialName={user.name} />}
    <section className="mt-6 rounded-xl border border-border p-4"><h2 className="font-semibold">Biblioteca da conta</h2><p className="mt-2 text-sm text-muted-foreground">Suas cifras e setlists são sincronizadas entre aparelhos. Áudios, modelos e partituras continuam locais.</p><p role="status" className="mt-2 text-sm">{sync.status === 'syncing' ? 'Sincronizando…' : sync.message || (sync.lastAt ? 'Biblioteca sincronizada.' : 'Preparando sincronização…')}</p><Button className="mt-3" variant="outline" disabled={!online || sync.status === 'syncing'} onClick={() => requestPersonalSync()}>Sincronizar agora</Button></section>
    {failure && <p role="alert" className="mt-4 text-sm text-danger">{failure}</p>}
    <Link to="/?aba=catalogo" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"><Music2 className="size-5" /> Explorar cifras</Link>
    <Button variant="outline" className="mt-3 min-h-11 w-full" disabled={busy} onClick={() => { setBusy(true); setError(null); void leaveAccount().catch(e => setError(accountError(e))).finally(() => setBusy(false)); }}><LogOut className="size-4" /> {busy ? 'Saindo…' : 'Sair desta conta'}</Button><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Sair bloqueia o acesso às telas até entrar novamente. As cifras salvas permanecem neste aparelho.</p></div>
  </section>;

  return <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: 'radial-gradient(ellipse at 15% 15%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 55%), radial-gradient(ellipse at 95% 85%, color-mix(in srgb, var(--glow) 12%, transparent), transparent 50%)' }} />
    <section className="w-full max-w-md">
      <div className="mb-8 flex items-center justify-center gap-3"><img src={`${import.meta.env.BASE_URL}icons/mark-96.png`} alt="" width={48} height={48} className="size-12 rounded-2xl shadow-lg" /><span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">will-music</span></div>
      <div className="glass rounded-[2rem] border border-border p-6 shadow-xl sm:p-8">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-chord"><AudioLines className="size-7" /></span>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight tracking-tight">Seu próximo acorde começa aqui.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Entre com sua conta Google para acessar o Estúdio, suas cifras, partituras e ferramentas de estudo.</p>
        {!online && <p role="status" className="mt-5 flex gap-2 rounded-xl border border-border bg-surface p-3 text-sm"><CloudOff className="size-5 shrink-0" /> É preciso conexão para entrar com Google. Se já entrou neste aparelho, aguarde a restauração da sessão salva.</p>}
        {failure && <div role="alert" className="mt-5 rounded-xl border border-danger/30 bg-surface p-3 text-sm text-danger"><p>{failure}</p>{(preparationError || sessionError) && <button type="button" onClick={retry} className="mt-2 min-h-10 font-semibold underline">Tentar novamente</button>}</div>}
        {!ready && <p role="status" className="mt-5 animate-pulse text-sm text-muted-foreground">Restaurando sua sessão…</p>}
        <button type="button" disabled={!ready || !google || busy || !online} onClick={() => void signIn()} className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-base font-semibold text-slate-900 shadow-md transition-[transform,box-shadow] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">
          {busy ? <LoaderCircle className="size-6 animate-spin" /> : <GoogleMark />}{busy ? 'Conectando com Google…' : 'Entrar com Google'}
        </button>
        <div className="mt-6 flex gap-2 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="size-5 shrink-0 text-chord" /><p>Seu acesso fica salvo quando o navegador permite. Com uma sessão restaurada, suas cifras salvas também podem ser usadas offline.</p></div>
      </div>
      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">Música e tecnologia para acompanhar sua evolução.</p>
    </section>
  </main>;
};
