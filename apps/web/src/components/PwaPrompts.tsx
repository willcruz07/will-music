import { Download, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import { dismissPwaNotice, isIosBrowser, useInstallPrompt, usePwaState } from '../lib/pwa.ts';
import { Button } from '../ui/Button.tsx';

/** Floating notice above the bottom bar: a new version is ready, or the app now works offline. */
export const UpdateBanner = () => {
  const { needRefresh, offlineReady, update } = usePwaState();
  if (!needRefresh && !offlineReady) return null;
  return (
    <div
      role="status"
      className="glass fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border px-4 py-3 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.5)] md:bottom-6"
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
