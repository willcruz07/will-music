import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import './styles.css';

import { startFolderAutoSync } from './lib/folder.ts';
import { notifyNeedRefresh, notifyOfflineReady } from './lib/pwa.ts';

startFolderAutoSync();

// A new build waits until the user taps Atualizar, so a song being played is never cut by a reload.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => notifyNeedRefresh(() => updateSW(true)),
  onOfflineReady: notifyOfflineReady,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
