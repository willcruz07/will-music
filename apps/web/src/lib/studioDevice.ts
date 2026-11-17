import { isIOS } from './ios.ts';

/** Covers iPadOS desktop user agents as well as Android phones/tablets. Not a memory benchmark. */
export const isMobileStudio = (): boolean => typeof navigator !== 'undefined' && (
  isIOS() || /android|mobile/i.test(navigator.userAgent)
);
export const MOBILE_LYRICS_NOTICE = 'A transcrição automática da letra está desativada em celulares e tablets, incluindo iPhone e iPad. O sistema pode interromper tarefas que usam muita memória. Neste aparelho, a letra é buscada no LRCLIB quando a música é analisada; para transcrever com Whisper, abra esta música em um computador. Você ainda pode inserir ou editar a letra manualmente.';
export const MOBILE_TRACKS_NOTICE = 'No celular e no tablet, a separação usa um modelo reduzido: 4 faixas (voz, bateria, baixo e outros), processadas no próprio aparelho e bem mais devagar que no computador. As faixas ficam só nesta sessão. Para 6 faixas, com violão/guitarra e piano, e melhor desempenho, use o Estúdio em um computador.';
/** Shown wherever a feature runs with reduced models on phones and tablets. */
export const MOBILE_MODELS_NOTICE = 'No celular, os modelos são reduzidos para caber na memória do aparelho. Para melhor desempenho e resultados completos, use um computador.';

const LITE_KEY = 'wm-mobile-lite-separation';
/** Light 4-track separation on phones is experimental: off until the musician turns it on on this device. */
export const mobileLiteSeparationEnabled = (): boolean => {
  try { return localStorage.getItem(LITE_KEY) === '1'; } catch { return false; }
};
export const setMobileLiteSeparation = (on: boolean): void => {
  try { if (on) localStorage.setItem(LITE_KEY, '1'); else localStorage.removeItem(LITE_KEY); } catch { /* per-device convenience only */ }
};
export const MOBILE_LITE_WARNING = 'Experimental: no celular a separação leve pode levar de 30 minutos a mais de uma hora por música e usar muita memória. Se o app fechar ou recarregar, este aparelho não aguenta o processamento. Mantenha a tela aberta e o celular na tomada.';
