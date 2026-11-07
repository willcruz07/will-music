# App — fatia "MP3 → cifra na tela" — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um PWA em que o usuário envia um MP3 e vê, na tela da música, o tom, a cifra gerada (letra do LRCLIB + acordes detectados no navegador) e um player que destaca a linha e o acorde atuais, com velocidade e transposição; tudo salvo localmente.

**Architecture:** `apps/web` (Vite + React) consome `@will-music/engine` (Plano 1). O áudio é decodificado na thread principal (`decodeAudioData` num `OfflineAudioContext` a 22050 Hz) e enviado a um Web Worker. O worker roda CQT, ChordMini e S-KEY com `onnxruntime-web` (WASM), usando um `TensorRunner` web. Os modelos são baixados do Hugging Face, conferidos por SHA-256 e guardados em Cache Storage. Os dados ficam no IndexedDB (Dexie). A cifra é gerada em ChordPro a partir da análise e da letra, e renderizada com acordes sobre a letra.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind 4, Radix (slider), lucide-react, react-router 8, Dexie 4, music-metadata, onnxruntime-web 1.31, vite-plugin-pwa, Vitest + Testing Library + jsdom + fake-indexeddb.

**Spec:** [`docs/superpowers/specs/2026-11-06-will-music-v1-design.md`](../specs/2026-11-06-will-music-v1-design.md) — §4, §5, §6, §7.1–7.6, §7.8, §8.

Cobre do spec:
- §7.1, base PWA;
- §7.2, biblioteca sem tags e favoritos;
- §7.3, adicionar áudio;
- §7.4, análise básica;
- §7.5, letra;
- §7.6, geração e renderização da cifra e transposição;
- §7.8, player sem faixas e sem loop A-B.

Ficam para os planos seguintes:
- editor de cifra e modo sincronizar (§5.5, §7.6 editor);
- diagramas de acorde;
- separação de faixas e mixer (§7.7);
- setlists e modo palco (§7.9);
- configurações e exportação/importação (§5.4, §7.10);
- modelo de batidas.

## Global Constraints

- Tudo do Plano 1 vale (licenças permissivas, engine sem DOM e sem `node:`, modelos fixados por revisão + SHA-256).
- O app nunca envia áudio para fora. A única chamada com dados da música é `GET https://lrclib.net/api/search?track_name=&artist_name=`.
- Visual do cifras.app:
  - Cor primária verde esmeralda `hsl(160 84% 39%)` (claro) / `hsl(160 84% 45%)` (escuro).
  - Raio 0,5 rem; tema claro e escuro por classe `dark` no `<html>`, com padrão do sistema.
  - Fonte Inter (fallback sans-serif).
- Interface em português do Brasil.
- Nada de inferência na thread principal.
- O registro de tudo que vai ao IndexedDB tem `id` (UUID), `createdAt` e `updatedAt` (ISO 8601).

## Review Focus

1. **Navegador sem WebGPU, ou modelo que falha ao baixar** → a análise mostra erro claro e a música continua salva e abrível, sem cifra. Teste na Task 4.
2. **MP3 sem tags ID3** → título vira o nome do arquivo sem extensão e o artista fica vazio, editável. Teste na Task 3.
3. **LRCLIB sem resultado, sem internet ou com versão de duração diferente** → cifra só com linhas instrumentais e aviso. Diferença > 5 s gera aviso de versão. Testes na Task 5.
4. **Transposição com bemóis e sustenidos** → `Bb` +2 = `C`, `C#m7` −1 = `Cm7`, `D/F#` +1 = `D#/G`, mantendo o sufixo. Teste na Task 6.
5. **Música sem letra sincronizada** (letra só em texto) → linhas recebem tempos distribuídos e a cifra continua gerada. Teste na Task 5.

---

## Estrutura de arquivos

```
apps/web/
  package.json, vite.config.ts, tsconfig.json, index.html
  public/icons/icon-192.png, icon-512.png     (gerados a partir de um SVG simples)
  src/main.tsx, src/App.tsx, src/styles.css   (tokens de tema)
  src/ui/                                     Button, Card, Badge, Progress, Slider (Radix), Input
  src/lib/db.ts                               Dexie: songs, audio, analyses, charts
  src/lib/metadata.ts                         readTags(file)
  src/lib/models.ts                           MODEL_FILES, fetchModel (Cache Storage + SHA-256)
  src/lib/webRunner.ts                        createWebRunner(bytes)
  src/lib/decode.ts                           decodeForAnalysis(file)
  src/lib/lrclib.ts                           searchLyrics, pickBestLyrics, parseLrc
  src/lib/chart.ts                            buildChart (análise + letra → ChordPro), parseChordPro
  src/lib/transpose.ts                        transposeChord, transposeKey
  src/worker/analysis.worker.ts               mensagens: analyze → progress/result/error
  src/worker/client.ts                        analyzeInWorker(channels, onProgress)
  src/pages/Library.tsx, NewSong.tsx, Song.tsx
  src/components/ChartView.tsx, Player.tsx, AnalysisProgress.tsx
  test/*.test.ts(x)
```

---

### Task 1: Esqueleto do app, tema e PWA

**Files:** criar `apps/web/*` (config, `main.tsx`, `App.tsx`, `styles.css`, `ui/*`, ícones), `apps/web/test/app.test.tsx`; modificar `package.json` raiz (workspace `apps/*`, script `dev`).

**Interfaces — Produces:**
- `App` com rotas: `/` → `Library`, `/nova` → `NewSong`, `/musica/:id` → `Song`. Nesta task são páginas vazias, só com o título.
- `ThemeToggle`: alterna a classe `dark` no `<html>` e guarda `localStorage['wm-theme']`.

- [ ] **Step 1: Teste que falha**

```tsx
it('renders the library at / with the app name', () => {
  render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
  expect(screen.getByText('will-music')).toBeInTheDocument();
});
it('toggles dark mode', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: /tema/i }));
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
```
- [ ] **Step 2: Rodar e ver falhar.** `npm test -w @will-music/web` → FAIL.
- [ ] **Step 3: Implementar.**
  - **Vite:** `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-pwa` (`registerType: 'prompt'`, manifest `name: "will-music"`, `theme_color: "#10b981"`, ícones 192/512, `display: "standalone"`, `lang: "pt-BR"`).
  - **Service worker:** o precache cobre só o app. Os modelos não entram, porque ficam no Cache Storage próprio (Task 4).
  - **Vitest:** `environment: 'jsdom'`.
  - **Tema:** tokens em `styles.css` como variáveis CSS, no padrão do cifras.app (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--card`), mapeados no `@theme` do Tailwind 4.
  - **Layout:** cabeçalho com "will-music" e o `ThemeToggle`.
- [ ] **Step 4: Rodar e ver passar** + `npm run build -w @will-music/web` termina sem erro e gera `dist/sw.js`.
- [ ] **Step 5: Commit** — `feat(web): esqueleto PWA, rotas e tema`

### Task 2: Banco local

**Files:** criar `apps/web/src/lib/db.ts`, `apps/web/test/db.test.ts`.

**Interfaces — Produces:**
- `type Song = { id: string; title: string; artist: string; durationSec: number; key?: string; tempo?: number; capo?: number; favorite: boolean; analysisStatus: 'pending' | 'running' | 'done' | 'error'; analysisError?: string; createdAt: string; updatedAt: string }`
- `type Analysis = { id: string; songId: string; schemaVersion: 1; models: Record<string, string>; key: KeyResult; chords: ChordSegment[]; lyrics?: { source: 'lrclib' | 'manual'; lrclibId?: number; lines: { start: number; text: string }[]; warning?: string }; createdAt: string; updatedAt: string }`
- `type Chart = { id: string; songId: string; chordPro: string; transpose: number; fontSize: number; origin: 'generated' | 'edited' | 'manual'; generatedFromAnalysisId?: string; createdAt: string; updatedAt: string }`
- `db`: Dexie `'will-music'` v1, tabelas `songs` (`id, title, artist, updatedAt`), `audio` (`songId` → `{ songId, blob, mimeType }`), `analyses` (`id, songId`), `charts` (`id, songId`).
- `createSong(input: { title; artist; durationSec }, audio: Blob): Promise<Song>`, `updateSong(id, patch): Promise<void>` (atualiza `updatedAt`), `deleteSong(id)` (apaga as 4 tabelas), `listSongs(): Promise<Song[]>` (por `updatedAt` desc).

*Regra:* áudio guardado como `Blob` no IndexedDB. O spec pede OPFS; IndexedDB funciona em todos os navegadores-alvo, inclusive o Safari, e a troca por OPFS fica isolada em `db.ts`.

- [ ] **Step 1: Teste que falha** (com `fake-indexeddb/auto`)

```ts
it('creates, lists and deletes a song with its audio', async () => {
  const s = await createSong({ title: 'Imperfeito', artist: 'Coral', durationSec: 294.8 }, new Blob(['x'], { type: 'audio/mpeg' }));
  expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(s.analysisStatus).toBe('pending');
  expect((await listSongs()).map((x) => x.title)).toEqual(['Imperfeito']);
  expect(await db.audio.get(s.id)).toBeTruthy();
  await deleteSong(s.id);
  expect(await listSongs()).toEqual([]);
  expect(await db.audio.get(s.id)).toBeUndefined();
});
it('bumps updatedAt on update', async () => { /* updatedAt depois > antes */ });
```
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): banco local com Dexie`

### Task 3: Tags do arquivo e decodificação

**Files:** criar `src/lib/metadata.ts`, `src/lib/decode.ts`, `test/metadata.test.ts`.

**Interfaces — Produces:**
- `readTags(file: File): Promise<{ title: string; artist: string; durationSec: number }>` — `music-metadata` `parseBlob`. Sem título, usa o nome do arquivo sem extensão; sem artista, `''`.
- `decodeForAnalysis(file: Blob): Promise<{ channels: Float32Array[]; sampleRate: 22050 }>` — `new OfflineAudioContext(2, 1, 22050).decodeAudioData(await file.arrayBuffer())`, devolvendo `getChannelData` de cada canal.

*Regra:* a reamostragem fica a cargo do navegador, mais rápida. A ferramenta da Fase 0 usa o resampler do engine. A diferença afeta pouco os acordes e fica registrada no ledger.

- [ ] **Step 1: Teste que falha** — `readTags` com `music-metadata` mockado (`vi.mock`):
  - sem `common.title`, `File(['x'], 'Minha Música.mp3')` → `{ title: 'Minha Música', artist: '', durationSec: 0 }`;
  - com tags → título e artista das tags e `format.duration`.
  - `decodeForAnalysis` não tem teste unitário (jsdom não tem Web Audio); é coberta no teste manual da Task 8.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): leitura de tags e decodificação`

### Task 4: Modelos e análise no Worker

**Files:** criar `src/lib/models.ts`, `src/lib/webRunner.ts`, `src/worker/analysis.worker.ts`, `src/worker/client.ts`, `test/models.test.ts`.

**Interfaces:**
- Consumes: `analyzeChords`, `analyzeKey`, `verifyCqtPlan`, `downmixMean`, `TensorRunner` (engine); os mesmos URLs e SHA-256 do Plano 1 (`tools/phase0/src/models.ts`). Mover a tabela `MODELS` para `packages/engine/src/models.ts` (só dados) e importar nos dois lugares.
- Produces:
  - `fetchModel(id: ModelId, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array>`.
    - Procura no `caches.open('wm-models-v1')`. Se não achar, baixa com streaming para o progresso, confere o SHA-256 (`crypto.subtle`) e guarda.
    - Hash divergente lança `Error('Modelo corrompido: <id>')` e não guarda.
  - `createWebRunner(model: Uint8Array): Promise<TensorRunner>` — `onnxruntime-web`, `executionProviders: ['wasm']`. Os arquivos WASM do ORT são servidos pelo Vite (`ort.env.wasm.wasmPaths` apontando para os assets copiados).
  - Protocolo do worker:
    - entrada `{ type: 'analyze', channels: Float32Array[] }` (transferidos);
    - saídas `{ type: 'progress', stage: 'models' | 'chords' | 'key', done: number, total: number }`, `{ type: 'result', key: KeyResult, chords: ChordSegment[], models: Record<string,string> }` e `{ type: 'error', message: string }`.
  - `analyzeInWorker(channels: Float32Array[], onProgress): Promise<{ key; chords; models }>` — cria o worker (`new Worker(new URL(..., import.meta.url), { type: 'module' })`) e rejeita com a mensagem de erro.

*Regra:* WASM primeiro, porque funciona em todo navegador. WebGPU fica como otimização posterior.

- [ ] **Step 1: Teste que falha** (`fetchModel`, com `caches` e `fetch` falsos):
  - baixa e guarda na primeira chamada;
  - lê do cache na segunda, sem `fetch`;
  - rejeita com `/Modelo corrompido/` quando o hash não bate, e não guarda nada.
- [ ] **Step 2–4:** falhar → implementar → passar. O worker e o runner são verificados no teste manual da Task 8.
- [ ] **Step 5: Commit** — `feat(web): modelos em cache e análise em worker`

### Task 5: Letra (LRCLIB) e geração da cifra

**Files:** criar `src/lib/lrclib.ts`, `src/lib/chart.ts`, `test/lrclib.test.ts`, `test/chart.test.ts`.

**Interfaces — Produces:**
- `type LrclibResult = { id: number; trackName: string; artistName: string; duration: number; syncedLyrics: string | null; plainLyrics: string | null }`
- `searchLyrics(title: string, artist: string, fetchFn = fetch): Promise<LrclibResult[]>`. Erro de rede ou HTTP retorna `[]`.
- `pickBestLyrics(results, audioDurationSec): { result: LrclibResult; warning?: string } | null`.
  - Prefere quem tem `syncedLyrics`; entre eles, a menor diferença de duração.
  - Diferença > 5 s → `warning: 'A letra encontrada pode ser de outra versão da música.'`.
- `parseLrc(text: string): { start: number; text: string }[]` — `[mm:ss.xx] texto`, ignora linhas vazias.
- `distributePlainLyrics(plain: string, durationSec: number): { start: number; text: string }[]` — distribui por igual entre 10% e 90% da duração.
- `buildChart(input: { title; artist; key: KeyResult; chords: ChordSegment[]; lines: { start: number; text: string }[] }): string` — ChordPro (§5.2, §7.6), com o algoritmo:
  - acordes com duração < 0,75 s e `N`/`X` descartados; repetições seguidas fundidas;
  - para cada linha de letra `[início, início da próxima)`, cada acorde que **começa** no intervalo é inserido na posição proporcional ao tempo, encaixado no início da palavra mais próxima: `[G]Ninguém explica [D]Deus`;
  - se o primeiro acorde da linha começa antes da linha e continua ativo, ele vai no início da linha;
  - acordes antes da primeira linha viram `{comment: Intro}` + `[G] [D] [Em] [C]`; entre linhas com intervalo > 8 s sem letra, `{comment: Instrumental}`; depois da última linha, `{comment: Final}`;
  - cabeçalho `{title: …}`, `{artist: …}`, `{key: G}` (`key.label` convertido para notação de cifra: `G major` → `G`, `F# minor` → `F#m`).
- `parseChordPro(text: string): { meta: Record<string,string>; lines: ({ kind: 'lyric'; parts: { chord?: string; text: string }[] } | { kind: 'comment'; text: string } | { kind: 'chords'; chords: string[] })[] }`.

- [ ] **Step 1: Testes que falham**

```ts
it('parses LRC', () => expect(parseLrc('[00:19.32] Linha um\n\n[01:02.5] Dois')).toEqual([{ start: 19.32, text: 'Linha um' }, { start: 62.5, text: 'Dois' }]));
it('picks synced lyrics closest in duration and warns on mismatch', () => {
  const r = [res({ id: 1, duration: 300, synced: true }), res({ id: 2, duration: 213, synced: true }), res({ id: 3, duration: 212, synced: false })];
  expect(pickBestLyrics(r, 212)!.result.id).toBe(2);
  expect(pickBestLyrics([res({ id: 1, duration: 300, synced: true })], 212)!.warning).toMatch(/outra versão/);
  expect(pickBestLyrics([], 212)).toBeNull();
});
it('returns [] when the request fails', async () => expect(await searchLyrics('a', 'b', async () => { throw new Error('offline'); })).toEqual([]));
it('places chords on word starts by time', () => {
  const cho = buildChart({ title: 'T', artist: 'A', key: key('G', 'major'), chords: [seg(0, 4, 'G'), seg(4, 6, 'D'), seg(6, 10, 'G')], lines: [{ start: 2, text: 'Ninguém explica Deus' }, { start: 10, text: 'fim' }] });
  expect(cho).toContain('{key: G}');
  expect(cho).toContain('{comment: Intro}');
  expect(cho).toContain('[G]Ninguém explica [D]Deus');
});
it('keeps instrumental gaps and the ending', () => { /* linhas a 5 s e 30 s → {comment: Instrumental}; acordes após a última linha → {comment: Final} */ });
it('generates a chart without lyrics', () => { const cho = buildChart({ ..., lines: [] }); expect(cho).toContain('[G]'); expect(cho).not.toContain('undefined'); });
it('distributes plain lyrics over the song', () => expect(distributePlainLyrics('a\nb', 100).map((l) => l.start)).toEqual([10, 50]));
it('round-trips through parseChordPro', () => { const p = parseChordPro('{title: T}\n[G]Ninguém [D]Deus'); expect(p.meta.title).toBe('T'); expect(p.lines[0]).toEqual({ kind: 'lyric', parts: [{ chord: 'G', text: 'Ninguém ' }, { chord: 'D', text: 'Deus' }] }); });
```
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): letra do LRCLIB e geração da cifra em ChordPro`

### Task 6: Transposição

**Files:** criar `src/lib/transpose.ts`, `test/transpose.test.ts`.

**Interfaces — Produces:**
- `transposeChord(chord: string, semitones: number, preferFlats = false): string`.
  - Transpõe a fundamental e o baixo depois de `/` e preserva o sufixo.
  - Usa sustenidos por padrão e bemóis quando `preferFlats`.
- `prefersFlats(key: string): boolean` — `true` para tons F, Bb, Eb, Ab, Db, Gb e Dm, Gm, Cm, Fm, Bbm, Ebm.
- `transposeKey(key: string, semitones: number): string` — a mesma regra; a grafia segue o tom de destino.

- [ ] **Step 1: Teste que falha**

```ts
it.each([['Bb', 2, false, 'C'], ['C#m7', -1, false, 'Cm7'], ['D/F#', 1, false, 'D#/G'], ['D/F#', 1, true, 'Eb/G'], ['G7M(9)', 5, false, 'C7M(9)'], ['A#m7(b5)', 0, false, 'A#m7(b5)']])
  ('transposes %s by %i', (c, n, flats, out) => expect(transposeChord(c, n, flats)).toBe(out));
it('spells keys by destination', () => { expect(transposeKey('G', 3)).toBe('Bb'); expect(transposeKey('Em', 2)).toBe('F#m'); });
```
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): transposição de acordes`

### Task 7: Telas — biblioteca, nova música, processamento e música

**Files:** criar `src/pages/Library.tsx`, `src/pages/NewSong.tsx`, `src/pages/Song.tsx`, `src/components/ChartView.tsx`, `src/components/Player.tsx`, `src/components/AnalysisProgress.tsx`, `src/lib/pipeline.ts`, `test/chartView.test.tsx`, `test/player.test.tsx`.

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces:
  - `runPipeline(songId: string, onProgress): Promise<void>`. Etapas:
    1. `analysisStatus = 'running'`;
    2. decodifica o áudio do banco;
    3. `analyzeInWorker`;
    4. `searchLyrics` e `pickBestLyrics`, com `parseLrc` ou `distributePlainLyrics`;
    5. salva a `Analysis`;
    6. salva a `Chart` (`origin: 'generated'`); se já existir uma `Chart` `edited`, não sobrescreve;
    7. atualiza `song.key`;
    8. `analysisStatus = 'done'`.
    - Qualquer erro → `'error'` + `analysisError`.
  - `ChartView({ chordPro, transpose, preferFlats, fontSize, activeLineIndex?, activeChordIndex? })`.
    - Acordes acima da sílaba, em verde (cor primária) e peso 600.
    - Comentários como rótulos de seção.
    - Linha ativa com fundo `muted` e rolagem `scrollIntoView({ block: 'center', behavior: 'smooth' })`.
  - `Player({ src, lines, chords, onTime })` sobre `HTMLAudioElement`:
    - play/pause e barra de tempo;
    - velocidade 50–150% (`playbackRate`, `preservesPitch = true`);
    - rolagem automática liga/desliga;
    - chama `onTime(t)` a cada `timeupdate` e também por `requestAnimationFrame` durante a reprodução.
  - `activeIndexAt(starts: number[], t: number): number` (busca binária; −1 antes do primeiro).
- Telas:
  - **Biblioteca:** lista com título, artista, tom e status (badge), busca por título/artista, botão "Adicionar música". Lista vazia mostra um convite para adicionar.
  - **Nova música:**
    1. escolher arquivo ou arrastar;
    2. mostrar título e artista lidos (editáveis) e a duração;
    3. "Analisar" cria a música e navega para `/musica/:id`, que dispara o pipeline.
  - **Música:**
    - Cabeçalho com título, artista e tom (com a transposição aplicada).
    - Controles: transpor −/+, tamanho da fonte −/+, reprocessar.
    - Enquanto analisa: `AnalysisProgress`, com a etapa atual e porcentagem ("Baixando modelos 12 MB de 17 MB", "Detectando acordes 3/5", "Detectando o tom", "Buscando a letra").
    - Concluído: aviso de versão da letra (se houver), `ChartView` e `Player` fixo no rodapé.
    - Erro: mensagem e botão "Tentar de novo".

- [ ] **Step 1: Testes que falham**

```tsx
it('renders chords above lyrics and highlights the active line', () => {
  render(<ChartView chordPro={'{comment: Intro}\n[G] [D]\n[G]Ninguém [D]Deus\nfim'} transpose={0} preferFlats={false} fontSize={16} activeLineIndex={2} />);
  expect(screen.getByText('Intro')).toBeInTheDocument();
  expect(screen.getAllByText('G')[0]).toHaveClass('text-primary');
  expect(screen.getByText('Ninguém').closest('[data-line]')).toHaveAttribute('data-active', 'true');
});
it('transposes the rendered chords', () => {
  render(<ChartView chordPro={'[G]Ninguém [D/F#]Deus'} transpose={2} preferFlats={false} fontSize={16} />);
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('E/G#')).toBeInTheDocument();
});
it('finds the active index by time', () => {
  expect(activeIndexAt([2, 5, 9], 1)).toBe(-1);
  expect(activeIndexAt([2, 5, 9], 5)).toBe(1);
  expect(activeIndexAt([2, 5, 9], 100)).toBe(2);
});
it('sets playback rate without changing pitch', async () => {
  render(<Player src="blob:x" lines={[]} chords={[]} onTime={() => {}} />);
  fireEvent.change(screen.getByLabelText('Velocidade'), { target: { value: '75' } });
  const audio = document.querySelector('audio')!;
  expect(audio.playbackRate).toBe(0.75);
  expect(audio.preservesPitch).toBe(true);
});
```
- [ ] **Step 2–4:** falhar → implementar → passar. `npm test` (raiz) verde e `npm run build -w @will-music/web` sem erro.
- [ ] **Step 5: Commit** — `feat(web): telas de biblioteca, nova música e música com player`

### Task 8: Teste no navegador real

- [ ] **Step 1:** `npm run dev -w @will-music/web` e abrir no Chrome (Claude in Chrome ou Playwright).
- [ ] **Step 2:** Adicionar `Primeiros Passos` (arquivo da pasta Música) → a tela de processamento mostra as etapas → a cifra aparece com tom G e a letra do LRCLIB.
  - No **Chrome do usuário**, o envio do arquivo é feito por ele.
  - No **Playwright**, por `setInputFiles`.
- [ ] **Step 3:** Dar play → a linha ativa acompanha a música; velocidade 75% mantém o tom; transpor +2 muda tom e acordes.
- [ ] **Step 4:** Recarregar a página → a música continua na biblioteca com a cifra (dados locais). Desligar a rede → abrir a música continua funcionando.
- [ ] **Step 5:** Registrar capturas de tela e o tempo de análise no ledger. Corrigir o que falhar (com teste que reproduz antes). Commit — `test(web): verificação em navegador`.
