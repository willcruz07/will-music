import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelsSetup } from '../src/components/ModelsSetup.tsx';
import * as models from '../src/lib/models.ts';
import * as whisper from '../src/lib/whisper.ts';

vi.mock('../src/lib/models.ts', async (orig) => ({
  ...(await orig<typeof import('../src/lib/models.ts')>()),
  missingModels: vi.fn(async () => ['chordnet', 'kara2Data']),
  downloadModels: vi.fn(async (_ids: string[], onProgress: (d: number, t: number) => void) => onProgress(10, 10)),
}));
vi.mock('../src/lib/whisper.ts', async (orig) => ({
  ...(await orig<typeof import('../src/lib/whisper.ts')>()),
  whisperCached: vi.fn(async () => false),
  preloadWhisper: vi.fn(async (onProgress: (d: number, t: number) => void) => onProgress(5, 5)),
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(models.missingModels).mockClear().mockResolvedValue(['chordnet', 'kara2Data']);
  vi.mocked(models.downloadModels).mockClear();
  vi.mocked(whisper.whisperCached).mockClear().mockResolvedValue(false);
  vi.mocked(whisper.preloadWhisper).mockClear();
});

describe('first-run models setup', () => {
  it('asks to install the basic models when they are missing, and installs them all', async () => {
    render(<ModelsSetup />);
    const dialog = await screen.findByRole('dialog', { name: /Preparar o will-music/ });
    expect(dialog).toHaveTextContent(/acordes/i);
    expect(dialog).toHaveTextContent(/letra/i);
    await userEvent.click(screen.getByRole('button', { name: 'Instalar agora' }));
    expect(models.downloadModels).toHaveBeenCalledWith(models.BASIC_MODELS, expect.any(Function));
    expect(whisper.preloadWhisper).toHaveBeenCalled();
    expect(await screen.findByText(/Tudo pronto/)).toBeInTheDocument();
  });

  it('"Depois" closes it and it does not ask again', async () => {
    const { unmount } = render(<ModelsSetup />);
    await userEvent.click(await screen.findByRole('button', { name: 'Depois' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    unmount();
    render(<ModelsSetup />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays quiet when everything is already installed', async () => {
    vi.mocked(models.missingModels).mockResolvedValue([]);
    vi.mocked(whisper.whisperCached).mockResolvedValue(true);
    render(<ModelsSetup />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
