import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualSong, saveEditedChart } from '../src/lib/chartEdit.ts';
import { createSong, db } from '../src/lib/db.ts';
import { EditChart } from '../src/pages/EditChart.tsx';
import { mapCatalogChart, saveCatalogChart } from '../src/lib/catalogData.ts';
import { CatalogChart } from '../src/pages/CatalogChart.tsx';
const remote = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../src/lib/cloud/catalog.ts', () => ({ getCatalogChart: remote.get, saveCatalogChordPro: remote.save, catalogError: (error: unknown) => error instanceof Error ? error.message : 'Erro no catálogo' }));

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
  remote.get.mockReset().mockResolvedValue(mapCatalogChart('legacy-edit', { title: 'Cifra antiga', content: '{Intro}\n[C/E]Letra' }));
  remote.save.mockReset().mockImplementation(async (base, chordPro) => ({ ...base, chordPro }));
});

describe('chart editor', () => {
  it('opens canonical editing from the catalog and saves the original and its library copy', async () => {
    render(<MemoryRouter initialEntries={['/catalogo/legacy-edit']}><Routes><Route path="/catalogo/:id" element={<CatalogChart />} /><Route path="/musica/:id/editar" element={<EditChart />} /><Route path="/musica/:id" element={<p>Catálogo e biblioteca atualizados</p>} /></Routes></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar em ChordPro' }));
    const box = await screen.findByLabelText('Cifra em ChordPro');
    fireEvent.change(box, { target: { value: '[G7(13)]Texto corrigido' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Catálogo e biblioteca atualizados')).toBeInTheDocument();
    expect(remote.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'legacy-edit' }), '[G7(13)]Texto corrigido');
    expect((await db.charts.toArray())[0]?.chordPro).toBe('[G7(13)]Texto corrigido');
  });
  it('allows explicitly saving a legacy catalog chart without artificial text edits', async () => {
    const item = mapCatalogChart('legacy-edit', { title: 'Cifra antiga', content: '{Intro}\n[C/E]Letra' })!;
    const song = await saveCatalogChart(item);
    render(<MemoryRouter initialEntries={[`/musica/${song.id}/editar`]}><Routes><Route path="/musica/:id/editar" element={<EditChart />} /><Route path="/musica/:id" element={<p>Migrada para ChordPro</p>} /></Routes></MemoryRouter>);
    await screen.findByLabelText('Cifra em ChordPro');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Migrada para ChordPro')).toBeInTheDocument();
    expect(remote.save).toHaveBeenCalledWith(expect.objectContaining({ sourceField: 'content' }), item.chordPro);
  });
  it('opens a legacy catalog chart only as ChordPro and saves edits in the canonical field', async () => {
    localStorage.removeItem('wm-edit-format');
    const item = mapCatalogChart('legacy-edit', { title: 'Cifra antiga', content: '{Intro}\n[C/E]Letra' })!;
    const song = await saveCatalogChart(item);
    render(<MemoryRouter initialEntries={[`/musica/${song.id}/editar`]}><Routes><Route path="/musica/:id/editar" element={<EditChart />} /><Route path="/musica/:id" element={<p>Cifra atualizada</p>} /></Routes></MemoryRouter>);
    const box = await screen.findByLabelText('Cifra em ChordPro');
    expect(box).toHaveValue(item.chordPro);
    expect(screen.queryByRole('radio', { name: 'Acordes em cima' })).toBeNull();
    fireEvent.change(box, { target: { value: '{comment: Intro}\n[Dm7]Letra revisada' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Cifra atualizada')).toBeInTheDocument();
    const saved = await db.charts.where('songId').equals(song.id).first();
    expect(saved?.chordPro).toBe('{comment: Intro}\n[Dm7]Letra revisada');
    expect(saved).not.toHaveProperty('content');
    expect(remote.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'legacy-edit' }), '{comment: Intro}\n[Dm7]Letra revisada');
  });
  it('keeps the draft on a catalog refusal and allows an explicitly personal save', async () => {
    const item = mapCatalogChart('legacy-edit', { title: 'Cifra antiga', content: '[C]Original' })!;
    const song = await saveCatalogChart(item);
    remote.save.mockRejectedValueOnce(Object.assign(new Error('Missing permissions'), { code: 'permission-denied' }));
    render(<MemoryRouter initialEntries={[`/musica/${song.id}/editar`]}><Routes><Route path="/musica/:id/editar" element={<EditChart />} /><Route path="/musica/:id" element={<p>Salvo pessoalmente</p>} /></Routes></MemoryRouter>);
    const box = await screen.findByLabelText('Cifra em ChordPro');
    fireEvent.change(box, { target: { value: '[Dm]Meu rascunho' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem permissão');
    expect(box).toHaveValue('[Dm]Meu rascunho');
    expect((await db.charts.where('songId').equals(song.id).first())?.chordPro).toBe('[C]Original');
    await userEvent.click(screen.getByRole('checkbox', { name: /Atualizar também/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Salvo pessoalmente')).toBeInTheDocument();
    expect((await db.charts.where('songId').equals(song.id).first())?.chordPro).toBe('[Dm]Meu rascunho');
    expect(remote.save).toHaveBeenCalledTimes(1);
  });
  it('saves an edited chart, marks it edited and keeps line times', async () => {
    const song = await createSong({ title: 'T', artist: 'A', durationSec: 10 }, new Blob());
    await db.charts.add({ id: 'c', songId: song.id, chordPro: '[G]um\ndois', lineTimes: [1, 5], transpose: 0, fontSize: 18, origin: 'generated', createdAt: '', updatedAt: '' });
    await saveEditedChart(song.id, '[G]um\n[C]dois\ntrês');
    const chart = await db.charts.get('c');
    expect(chart).toMatchObject({ chordPro: '[G]um\n[C]dois\ntrês', origin: 'edited', lineTimes: [1, 5, null] });
  });

  it('edits in the page and returns to the song on save', async () => {
    const song = await createManualSong('Minha cifra', '');
    render(
      <MemoryRouter initialEntries={[`/musica/${song.id}/editar`]}>
        <Routes>
          <Route path="/musica/:id/editar" element={<EditChart />} />
          <Route path="/musica/:id" element={<p>tela da música</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('radio', { name: 'ChordPro' }));
    const box = await screen.findByLabelText('Cifra em ChordPro');
    await userEvent.type(box, '[[G]Santo');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('tela da música')).toBeInTheDocument();
    const chart = await db.charts.where('songId').equals(song.id).first();
    expect(chart!.chordPro).toContain('[G]Santo');
    expect(chart!.origin).toBe('edited');
  });

  it('creates a song without audio with an empty manual chart', async () => {
    const song = await createManualSong('Sem áudio', 'Eu');
    expect(song.analysisStatus).toBe('done');
    expect(await db.audio.get(song.id)).toBeUndefined();
    expect((await db.charts.where('songId').equals(song.id).first())!.origin).toBe('manual');
  });
});

describe('review fixes: editor', () => {
  it('keeps line timing of charts saved before lineTimes existed', async () => {
    const song = await createSong({ title: 'T', artist: 'A', durationSec: 10 }, new Blob());
    await db.analyses.add({ id: 'a', songId: song.id, schemaVersion: 1, models: {}, key: { root: 'G', mode: 'major', label: 'G major', index: 10, margin: 0 }, chords: [], lyrics: { source: 'lrclib', lines: [{ start: 3, text: 'um' }, { start: 8, text: 'dois' }] }, createdAt: '', updatedAt: '' });
    await db.charts.add({ id: 'c', songId: song.id, chordPro: 'um\ndois', transpose: 0, fontSize: 18, origin: 'generated', createdAt: '', updatedAt: '' });
    await saveEditedChart(song.id, '[G]um\ndois');
    expect((await db.charts.get('c'))!.lineTimes).toEqual([3, 8]);
  });
});


describe('editing lyrics and chords', () => {
  const open = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/musica/${id}/editar`]}>
        <Routes>
          <Route path="/musica/:id/editar" element={<EditChart />} />
          <Route path="/musica/:id" element={<p>tela da música</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it('opens filled in with the chords above the lyric and saves it back as ChordPro', async () => {
    localStorage.removeItem('wm-edit-format');
    const song = await createManualSong('Hino', '');
    await saveEditedChart(song.id, '[G]Santo [D]santo');
    open(song.id);
    const box = (await screen.findByLabelText('Cifra com os acordes em cima da letra')) as HTMLTextAreaElement;
    expect(box.value).toBe('G     D\nSanto santo');
    await userEvent.clear(box);
    await userEvent.type(box, 'C     G{enter}Santo santo');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('tela da música');
    expect((await db.charts.where('songId').equals(song.id).first())!.chordPro).toBe('[C]Santo [G]santo');
  });

  it('inserts a chord from the library at the cursor', async () => {
    const song = await createManualSong('Hino', '');
    await saveEditedChart(song.id, '{title: Hino}');
    open(song.id);
    await userEvent.click(await screen.findByRole('radio', { name: 'ChordPro' }));
    const box = (await screen.findByLabelText('Cifra em ChordPro')) as HTMLTextAreaElement;
    await userEvent.click(box);
    await userEvent.type(box, '{end}{enter}Santo');
    await userEvent.click(screen.getByRole('button', { name: /Inserir acorde/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'A (Lá)' }));
    await userEvent.click(screen.getByRole('radio', { name: 'm7' }));
    await userEvent.click(screen.getByRole('button', { name: 'Usar Am7' }));
    expect(box.value).toContain('Santo[Am7]');
  });
});

describe('review fixes: editing without losses', () => {
  const openEditor = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/musica/${id}/editar`]}>
        <Routes>
          <Route path="/musica/:id/editar" element={<EditChart />} />
          <Route path="/musica/:id" element={<p>tela da música</p>} />
        </Routes>
      </MemoryRouter>,
    );

  it('opens a chart with chords the layout cannot hold in ChordPro, with a notice', async () => {
    localStorage.removeItem('wm-edit-format');
    const song = await createManualSong('Hino', '');
    await saveEditedChart(song.id, 'E\n[C(add9)]Letra [G]mais');
    openEditor(song.id);
    expect(((await screen.findByLabelText('Cifra em ChordPro')) as HTMLTextAreaElement).value).toBe('E\n[C(add9)]Letra [G]mais');
    expect(screen.getByRole('status')).toHaveTextContent(/só em ChordPro/);
    await userEvent.click(screen.getByRole('radio', { name: 'Acordes em cima' }));
    expect(screen.getByLabelText('Cifra em ChordPro')).toBeInTheDocument();
  });

  it('does not save an unchanged chart with Ctrl+S', async () => {
    const song = await createManualSong('Hino', '');
    await db.charts.where('songId').equals(song.id).modify({ chordPro: '[G]Santo', origin: 'manual' });
    openEditor(song.id);
    await screen.findByLabelText(/Cifra/);
    await userEvent.keyboard('{Control>}s{/Control}');
    expect((await db.charts.where('songId').equals(song.id).first())!.origin).toBe('manual');
  });

  it('puts an inserted chord on the chord line above the cursor', async () => {
    localStorage.removeItem('wm-edit-format');
    const song = await createManualSong('Hino', '');
    await db.charts.where('songId').equals(song.id).modify({ chordPro: '[G]Ninguém explica' });
    openEditor(song.id);
    const box = (await screen.findByLabelText('Cifra com os acordes em cima da letra')) as HTMLTextAreaElement;
    box.setSelectionRange(box.value.indexOf('explica'), box.value.indexOf('explica'));
    box.dispatchEvent(new Event('select', { bubbles: true }));
    await userEvent.click(screen.getByRole('button', { name: /Inserir acorde/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Usar G' }));
    await userEvent.click(screen.getByRole('button', { name: /Inserir acorde/ }));
    await userEvent.clear(screen.getByLabelText('Acorde digitado'));
    await userEvent.type(screen.getByLabelText('Acorde digitado'), 'D');
    await userEvent.click(screen.getByRole('button', { name: 'Usar D' }));
    expect(box.value.split('\n')[1]).toBe('Ninguém explica');
  });
});
