import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelId } from '@will-music/engine';
import { ModelsSetup } from '../src/components/ModelsSetup.tsx';
import * as models from '../src/lib/models.ts';
import { reminderDue } from '../src/lib/modelsReminder.ts';
import * as whisper from '../src/lib/whisper.ts';
import { DialogHost } from '../src/ui/Dialog.tsx';

let cached = new Set<ModelId>();
let whisperIn = false;

vi.mock('../src/lib/models.ts', async (orig) => ({
  ...(await orig<typeof import('../src/lib/models.ts')>()),
  missingModels: vi.fn(),
  downloadModels: vi.fn(),
}));
vi.mock('../src/lib/whisper.ts', async (orig) => ({
  ...(await orig<typeof import('../src/lib/whisper.ts')>()),
  whisperCached: vi.fn(),
  preloadWhisper: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  cached = new Set(models.CHORD_MODELS);
  whisperIn = false;
  vi.mocked(models.missingModels).mockReset().mockImplementation(async (ids: ModelId[] = []) => ids.filter((id) => !cached.has(id)));
  vi.mocked(models.downloadModels).mockReset().mockImplementation(async (ids: ModelId[], onProgress) => {
    onProgress(10, 10);
    for (const id of ids) cached.add(id);
  });
  vi.mocked(whisper.whisperCached).mockReset().mockImplementation(async () => whisperIn);
  vi.mocked(whisper.preloadWhisper).mockReset().mockImplementation(async (onProgress) => {
    onProgress(5, 5);
    whisperIn = true;
  });
});

const setup = () =>
  render(
    <>
      <ModelsSetup />
      <DialogHost />
    </>,
  );

describe('first-run models setup', () => {
  it('lists the models with a check on the ones already downloaded, and checks each one as it lands', async () => {
    setup();
    const sheet = await screen.findByRole('dialog', { name: /Preparar o will-music/ });
    const row = (name: RegExp) => within(sheet).getByText(name).closest('li')!;
    expect(row(/Acordes e tom/)).toHaveTextContent('Baixado');
    expect(row(/^Separar faixas$/)).not.toHaveTextContent('Baixado');
    await userEvent.click(screen.getByRole('button', { name: 'Instalar agora' }));
    expect(models.downloadModels).toHaveBeenCalledWith(['basicPitch'], expect.any(Function));
    expect(models.downloadModels).toHaveBeenCalledWith(['demucs6s'], expect.any(Function));
    expect(whisper.preloadWhisper).toHaveBeenCalled();
    expect(await screen.findByText(/Tudo pronto/)).toBeInTheDocument();
  });

  it('installs the default six-track model without an optional checkbox', async () => {
    setup();
    await screen.findByRole('dialog', { name: /Preparar o will-music/ });
    expect(screen.queryByRole('checkbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Instalar agora' }));
    await screen.findByText(/Tudo pronto/);
    expect(models.downloadModels).toHaveBeenCalledWith(['demucs6s'], expect.any(Function));
  });

  it('closing without the basic models asks first: "Não" keeps the sheet open', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Depois' }));
    const ask = await screen.findByRole('alertdialog');
    expect(ask).toHaveTextContent(/não baixou os modelos básicos/);
    await userEvent.click(within(ask).getByRole('button', { name: 'Não' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: /Preparar o will-music/ })).toBeInTheDocument();
  });

  it('"Sim, seguir" closes it, it does not ask again, and the red notice waits', async () => {
    const { unmount } = setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Depois' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sim, seguir' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(reminderDue()).toBe(false);
    unmount();
    setup();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/não tem os modelos/)).toBeNull();
  });

  it('stays quiet when everything is already installed', async () => {
    cached = new Set([...models.CHORD_MODELS, 'demucs6s', 'basicPitch']);
    whisperIn = true;
    setup();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('missing models notice', () => {
  beforeEach(() => localStorage.setItem('wm-models-asked', '1'));

  it('floats while basic models are missing; "Baixar" opens the sheet', async () => {
    setup();
    await screen.findByText('Você não tem os modelos baixados no app.');
    await userEvent.click(screen.getByRole('button', { name: 'Baixar' }));
    expect(await screen.findByRole('dialog', { name: /Preparar o will-music/ })).toBeInTheDocument();
  });

  it('closing it offers "Me lembre mais tarde" and "Não me exiba mais"', async () => {
    setup();
    await screen.findByText('Você não tem os modelos baixados no app.');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    const ask = await screen.findByRole('alertdialog');
    expect(within(ask).getByRole('button', { name: 'Não me exiba mais' })).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Me lembre mais tarde' }));
    expect(screen.queryByText(/não tem os modelos/)).toBeNull();
    expect(reminderDue()).toBe(false);
    expect(reminderDue(Date.now() + 25 * 60 * 60 * 1000)).toBe(true);
  });

  it('"Não me exiba mais" hides it for good', async () => {
    setup();
    await screen.findByText('Você não tem os modelos baixados no app.');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Não me exiba mais' }));
    expect(reminderDue(Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});
