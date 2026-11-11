import { downmixMean } from '@will-music/engine';
import { type StemsRecord } from './db.ts';
import { decodeForAnalysis } from './decode.ts';
import { getSessionStems, setSessionStems } from './sessionStems.ts';
import { hasUsableWebGpu, listStemSets, separateSong, type SeparationProgress } from './stems.ts';
import { isIOS } from './ios.ts';
import { confirmDialog } from '../ui/Dialog.tsx';

export const prepareAnalysisStems = async (songId: string, progress: (p: SeparationProgress) => void, signal?: AbortSignal): Promise<{ stems?: StemsRecord; warning?: string }> => {
  signal?.throwIfAborted();
  const existing = getSessionStems(songId) ?? (await listStemSets(songId)).find((set) => set.mode === 'six');
  if (existing) return { stems: existing };
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!(await hasUsableWebGpu(gpu))) return { warning: 'Separação indisponível neste navegador. A letra e os acordes foram analisados a partir do áudio original.' };
  if (isIOS() && !(await confirmDialog({
    title: 'Separar faixas neste aparelho?',
    message: 'A separação usa bastante memória e pode recarregar o navegador no iPhone ou iPad. Prefira o computador. Você pode continuar a análise com o áudio original sem separar as faixas.',
    confirmLabel: 'Separar neste aparelho', cancelLabel: 'Usar áudio original',
  }))) return { warning: 'Você optou por analisar o áudio original, sem separar as faixas.' };
  signal?.throwIfAborted();
  const result = await separateSong(songId, progress, { mode: 'six', persist: false, signal });
  setSessionStems(songId, result.record);
  return { stems: result.record };
};

/** Keep bass/inversions and unclassified harmony; decode one compressed track at a time. */
export const decodeHarmonicAudio = async (stems: StemsRecord) => {
  const tracks = stems.tracks.filter((track) => ['bass', 'guitar', 'piano', 'other'].includes(track.name));
  if (tracks.length !== 4) throw new Error('As faixas harmônicas estão incompletas.');
  let mix = new Float32Array(0);
  for (const track of tracks) {
    const decoded = await decodeForAnalysis(track.blob);
    const mono = downmixMean(decoded.channels);
    if (mono.length > mix.length) { const larger = new Float32Array(mono.length); larger.set(mix); mix = larger; }
    for (let i = 0; i < mono.length; i++) mix[i] = mix[i]! + mono[i]!;
  }
  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  if (peak > 1) for (let i = 0; i < mix.length; i++) mix[i] = mix[i]! / peak;
  return { channels: [mix], sampleRate: 22050, durationSec: mix.length / 22050 };
};
