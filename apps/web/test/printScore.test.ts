import { afterEach, expect, it, vi } from 'vitest';
import { printScore } from '../src/lib/printScore.ts';
const state = vi.hoisted(() => ({ pages: true, options: {} as Record<string, unknown>, load: vi.fn(), clear: vi.fn() }));
vi.mock('opensheetmusicdisplay', () => ({ OpenSheetMusicDisplay: class {
  constructor(private host: HTMLElement, options: Record<string, unknown>) { state.options = options; }
  load = state.load;
  clear = state.clear;
  render() { if (state.pages) for (let i = 0; i < 2; i++) this.host.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); }
} }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); state.pages = true; });

it('prints only engraved A4 score pages and cleans its iframe after printing', async () => {
  const print = vi.fn();
  const append = document.body.append.bind(document.body);
  vi.spyOn(document.body, 'append').mockImplementation((...nodes) => {
    append(...nodes);
    for (const node of nodes) if (node instanceof HTMLIFrameElement) { node.contentWindow!.print = print; node.contentWindow!.focus = vi.fn(); }
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  await printScore('<score-partwise/>', 'Melodia');
  expect(state.options.pageFormat).toBe('A4_P');
  expect(state.load).toHaveBeenCalledWith('<score-partwise/>');
  const frame = document.querySelector('iframe')!;
  expect(frame.contentDocument!.title).toBe('Melodia');
  expect(frame.contentDocument!.querySelectorAll('.page svg')).toHaveLength(2);
  expect(frame.contentDocument!.querySelector('button')).toBeNull();
  expect(print).toHaveBeenCalledTimes(1);
  frame.contentWindow!.dispatchEvent(new Event('afterprint'));
  expect(document.querySelector('iframe')).toBeNull();
});

it('reports a score that cannot render and releases printing state', async () => {
  state.pages = false;
  await expect(printScore('<invalid/>', 'Teste')).rejects.toThrow('ainda não está pronta');
  await expect(printScore('<invalid/>', 'Teste')).rejects.toThrow('ainda não está pronta');
  expect(document.querySelector('iframe')).toBeNull();
});
