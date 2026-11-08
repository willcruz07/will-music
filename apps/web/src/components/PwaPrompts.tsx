import { Download, MonitorDown, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { dismissInstall, dismissPwaNotice, installDismissed, isIosBrowser, isStandalone, useInstallPrompt, usePwaState } from '../lib/pwa.ts';
import { Button } from '../ui/Button.tsx';

/** Floating notice above the bottom bar: a new version is ready, or the app now works offline. */
export const UpdateBanner = () => {
  const { needRefresh, offlineReady, update } = usePwaState();
  if (!needRefresh && !offlineReady) return null;
  return (
    <div
      role="status"
      className="glass player-slide fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border px-4 py-3 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.5)] lg:bottom-6"
      style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 1.5rem)' }}
    >
      {needRefresh ? <RefreshCw className="size-5 shrink-0 text-primary" /> : <WifiOff className="size-5 shrink-0 text-primary" />}
      <p className="flex-1 text-sm">{needRefresh ? 'Nova versão disponível.' : 'Pronto: o will-music agora funciona sem internet.'}</p>
      {needRefresh && update && (
        <Button className="min-h-9 px-3" onClick={() => void update()}>
          Atualizar
        </Button>
      )}
      <button type="button" aria-label="Fechar aviso" className="-mr-1 inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted" onClick={dismissPwaNotice}>
        <X className="size-4" />
      </button>
    </div>
  );
};

/** Install button where the browser offers it; instructions on iPhone/iPad. */
export const InstallApp = () => {
  const { canInstall, install } = useInstallPrompt();
  if (canInstall) {
    return (
      <Button onClick={() => void install()}>
        <Download className="size-4" /> Instalar o will-music
      </Button>
    );
  }
  if (isIosBrowser()) {
    return (
      <p className="text-sm text-muted-foreground">
        No iPhone ou iPad: toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" /> e depois em “Adicionar à Tela de Início”.
      </p>
    );
  }
  const installed = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  return <p className="text-sm text-muted-foreground">{installed ? 'Você já está usando o app instalado.' : 'Para instalar, use a opção “Instalar app” ou “Adicionar à tela inicial” no menu do navegador.'}</p>;
};

/** One-time invitation to install, under the header. Dismissing it is remembered on this device. */
export const InstallBanner = () => {
  const { canInstall, install } = useInstallPrompt();
  const [hidden, setHidden] = useState(installDismissed);
  const ios = isIosBrowser();
  if (hidden || isStandalone() || (!canInstall && !ios)) return null;
  const close = () => {
    dismissInstall();
    setHidden(true);
  };
  return (
    <div className="mx-auto mt-3 flex max-w-5xl items-start gap-3 px-4">
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3">
        <MonitorDown className="size-5 shrink-0 text-primary" />
        <p className="min-w-48 flex-1 text-sm">
          <span className="font-semibold">Instale o will-music.</span> Abre em tela cheia, funciona sem internet e o navegador passa a proteger suas músicas, faixas e modelos no aparelho.
          {ios && !canInstall && (
            <span className="mt-1 block text-muted-foreground">
              Toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" /> e depois em “Adicionar à Tela de Início”.
            </span>
          )}
        </p>
        <span className="flex gap-2">
          {canInstall && (
            <Button className="min-h-9 px-3" onClick={() => void install()}>
              <Download className="size-4" /> Instalar
            </Button>
          )}
          <Button variant="ghost" className="min-h-9 px-3" onClick={close}>
            Agora não
          </Button>
        </span>
      </div>
    </div>
  );
};

/** How to install in browsers that offer no install prompt (iPhone, Firefox, or before the browser decides). */
const InstallSteps = () =>
  isIosBrowser() ? (
    <p>
      No iPhone ou iPad, abra no Safari, toque em <Share className="inline size-4 align-text-bottom" aria-label="Compartilhar" /> e depois em “Adicionar à Tela de Início”.
    </p>
  ) : (
    <>
      <p>No Chrome ou no Edge: abra o menu do navegador (⋮ ou …) e escolha “Instalar will-music” ou “Instalar app”. No computador também aparece um ícone de instalar na barra de endereço.</p>
      <p className="mt-2">No Android: menu do navegador → “Instalar app” ou “Adicionar à tela inicial”.</p>
    </>
  );
