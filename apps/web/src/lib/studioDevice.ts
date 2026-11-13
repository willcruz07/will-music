import { isIOS } from './ios.ts';

/** Covers iPadOS desktop user agents as well as Android phones/tablets. Not a memory benchmark. */
export const isMobileStudio = (): boolean => typeof navigator !== 'undefined' && (
  isIOS() || /android|mobile/i.test(navigator.userAgent)
);
export const MOBILE_LYRICS_NOTICE = 'A transcrição automática da letra está desativada em celulares e tablets, incluindo iPhone e iPad. O sistema pode interromper tarefas que usam muita memória. Para transcrever com Whisper, abra esta música em um computador. Você ainda pode inserir ou editar a letra manualmente.';
export const MOBILE_TRACKS_NOTICE = 'Para separar e mixar faixas, abra o Estúdio em um computador. Este recurso está desativado em celulares e tablets, incluindo iPhone e iPad, porque o uso elevado de memória pode interromper o processamento ou recarregar a página. Neste aparelho, você pode ouvir o áudio original e identificar tom e acordes sem separar as faixas.';
