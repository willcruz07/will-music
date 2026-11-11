import { isIOS } from './ios.ts';
import { detectWhisperDevice } from './whisperModel.ts';

export type ExecutionPreference = 'auto' | 'parallel' | 'sequential';
export type AnalysisExecution = Exclude<ExecutionPreference, 'auto'>;
const KEY = 'wm-analysis-execution';
let sessionPreference: ExecutionPreference | undefined;
export const readExecutionPreference = (): ExecutionPreference => {
  if (sessionPreference) return sessionPreference;
  try { const value = localStorage.getItem(KEY); return value === 'parallel' || value === 'sequential' ? value : 'auto'; }
  catch { return 'auto'; }
};
export const saveExecutionPreference = (value: ExecutionPreference): void => {
  sessionPreference = value;
  try { localStorage.setItem(KEY, value); } catch { /* Session behavior can still be tested. */ }
};
export const resolveAnalysisExecution = async (requested: ExecutionPreference = readExecutionPreference()): Promise<AnalysisExecution> => {
  // Mobile always runs one analysis model at a time, even with a saved desktop preference.
  if (isIOS() || /android|mobile/i.test(navigator.userAgent)) return 'sequential';
  if (requested !== 'auto') return requested;
  // This is a conservative scheduling policy, not a proof of sufficient device memory.
  if (isIOS() || (navigator.hardwareConcurrency ?? 1) < 4) return 'sequential';
  return await detectWhisperDevice() === 'webgpu' ? 'parallel' : 'sequential';
};

export const isResourceFailure = (error: unknown): boolean =>
  /out.of.memory|bad_alloc|memory access out of bounds|failed to allocate|allocation failed|device.*lost|GPU.*memory|WebAssembly.*memory/i.test(error instanceof Error ? error.message : String(error));

/** Retry the entire transcript only when the model export lacks word-alignment outputs. */
export const isWordTimestampFailure = (error: unknown): boolean =>
  /alignment_heads|cross.?attention|output_attentions|token_timestamps|word.?level.*timestamp|timestamp.*word|timestamp.*not supported/i.test(error instanceof Error ? error.message : String(error));
