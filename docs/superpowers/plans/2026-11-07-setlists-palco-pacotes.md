# Setlists, modo palco e pacotes — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar listas de músicas para o culto, ensaio ou show, tocá-las em sequência num modo palco legível e confiável (offline, tela acesa, pedal Bluetooth) e levar músicas e listas do computador para o celular por pacote `.zip`.

**Architecture:** Tabela `setlists` no Dexie (versão 2 do banco). O modo palco é uma rota de tela cheia que só lê dados locais e nunca carrega modelos. Pacotes `.willmusic.zip` (fflate) com manifest, ChordPro, análise e áudio opcional, conforme spec §5.4. Uma página de ajustes reúne tema, modelos baixados, armazenamento e backup.

**Tech Stack:** o dos planos anteriores + `fflate` (MIT) e `@dnd-kit/core` + `@dnd-kit/sortable` (MIT; o cifras.app já usava).

**Spec:** [`docs/superpowers/specs/2026-11-06-will-music-v1-design.md`](../specs/2026-11-06-will-music-v1-design.md) — §5.1 (Setlist), §5.4, §7.9, §7.10.

## Global Constraints

- Tudo dos planos anteriores vale.
- **Tom na setlist:** `targetKey` é o tom absoluto daquela lista; sem ele, vale o tom mostrado na música. Mudar o tom no palco grava só no item da lista (spec §5.1).
- **Modo palco sem modelos e sem rede:**
  - abrir uma música em menos de 1 s num celular intermediário;
  - tema escuro por padrão;
  - Screen Wake Lock;
  - teclas setas, PageUp/PageDown e espaço (pedais Bluetooth).
- **Pacote `.willmusic.zip`:**
  - `manifest.json` com `{ format: 'will-music', version: 1, kind: 'song' | 'setlist' | 'backup' }`;
  - por música: `songs/<id>/song.json`, `chart.cho`, `chart.json` (`transpose`, `fontSize`, `origin`, `lineTimes`), `analysis.json` e, opcional, `audio.<ext>`;
  - `setlist.json` nas listas.
- **Importar `id` existente:** perguntar "Substituir ou manter as duas". Substituir troca tudo, inclusive o áudio (spec §5.4).

## Review Focus

1. **Música apagada da biblioteca que ainda está numa lista** → o item aparece como "Música não encontrada" e o palco pula para a próxima, sem quebrar. Teste na Task 1.
2. **Pacote corrompido, de outro app ou de versão futura** → erro claro ("Este arquivo não é um pacote do will-music" ou "versão mais nova"), nada gravado. Teste na Task 4.
3. **Importar um pacote cuja música já existe** → substituir troca cifra, análise e áudio; manter as duas cria cópias com `id` novo. A lista importada aponta para as músicas certas. Teste na Task 4.
4. **Wake Lock indisponível** (Firefox, permissão negada) ou perdido ao trocar de aba → o palco funciona e tenta de novo ao voltar à aba. Teste na Task 3.
5. **Pedal mandando espaço ou PageDown enquanto um campo está em foco** → não navega nem rola fora de hora. Teste na Task 3.

---

### Task 1: Setlists no banco

**Files:** modificar `apps/web/src/lib/db.ts` (versão 2: `setlists: 'id, updatedAt'`); criar `apps/web/src/lib/setlists.ts`, `apps/web/test/setlists.test.ts`.

**Interfaces — Produces:**
- `type SetlistItem = { songId: string; targetKey?: string; note?: string }`
- `type Setlist = { id; name: string; date?: string; items: SetlistItem[]; createdAt; updatedAt }`
- `createSetlist(name: string): Promise<Setlist>`, `updateSetlist(id, patch)`, `deleteSetlist(id)`, `listSetlists()` (por `updatedAt` desc)
- `addToSetlist(id, songId)` — permite a mesma música duas vezes
- `moveItem(items: SetlistItem[], from: number, to: number): SetlistItem[]` (pura)
- `resolveItems(setlist): Promise<{ item: SetlistItem; song?: Song; chart?: Chart }[]>`
- `deleteSong` (Plano 2) **não** remove a música das listas; `resolveItems` devolve `song: undefined` para ela.

- [ ] **Step 1: Testes que falham**
  - criar, listar, renomear e excluir;
  - `addToSetlist` duas vezes a mesma música gera 2 itens;
  - `moveItem([a, b, c], 0, 2)` → `[b, c, a]`; índices fora do intervalo → cópia sem mudança;
  - música apagada → `resolveItems` devolve o item com `song: undefined`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): setlists no banco local`

### Task 2: Telas de setlists e navegação

**Files:** criar `apps/web/src/pages/Setlists.tsx`, `apps/web/src/pages/SetlistEdit.tsx`, `apps/web/src/components/AppNav.tsx`, `apps/web/test/setlistEdit.test.tsx`; modificar `App.tsx` (rotas `/listas`, `/listas/:id`; navegação Biblioteca · Listas · Ajustes, com barra inferior no celular) e `Song.tsx` (botão "Adicionar a uma lista").

**Interfaces — Produces:**
- **`/listas`:** lista com nome, data e número de músicas, mais o botão "Nova lista".
- **`/listas/:id`:**
  - nome e data editáveis;
  - itens arrastáveis (`@dnd-kit/sortable`), também com botões "Subir" e "Descer" para teclado e leitor de tela;
  - por item: tom (seletor com os 12 tons maiores ou menores, conforme o tom da música, mais "Tom original"), observação curta e "Remover";
  - "Adicionar músicas": busca na biblioteca;
  - botão "Tocar no palco".
- `keyOptions(songKey: string): string[]` — 12 tons do mesmo modo, a partir do tom da música, com a grafia de `transposeKey`.

- [ ] **Step 1: Testes que falham**
  - `keyOptions('G')` tem 12 itens, começa em `G` e contém `Bb` e `F#`; `keyOptions('Em')` só tem tons menores;
  - na página (`MemoryRouter` + `fake-indexeddb`): adicionar 2 músicas pela busca; "Descer" no primeiro inverte a ordem e persiste; escolher o tom `A` grava `targetKey: 'A'`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): telas de setlists e navegação`

### Task 3: Modo palco

**Files:** criar `apps/web/src/pages/Stage.tsx`, `apps/web/src/lib/stage.ts`, `apps/web/src/lib/wakeLock.ts`, `apps/web/test/stage.test.ts`, `apps/web/test/stagePage.test.tsx`; modificar `App.tsx` (rotas `/palco/lista/:id` e `/palco/musica/:id`, fora do layout com cabeçalho).

**Interfaces — Produces:**
- `stageAction(e: { key: string; code: string; targetTag?: string }): 'next' | 'prev' | 'scroll-down' | 'scroll-up' | null`.
  - `ArrowRight`/`PageDown` → `next`; `ArrowLeft`/`PageUp` → `prev`.
  - `ArrowDown`/`Space` → `scroll-down`; `ArrowUp` → `scroll-up`.
  - `null` quando `targetTag` é `INPUT`, `TEXTAREA` ou `SELECT`.
- `semitonesTo(fromKey: string, toKey: string): number` — no intervalo −5…+6, sem pular de oitava.
- `useWakeLock(active: boolean)`:
  - pede `navigator.wakeLock.request('screen')`;
  - pede de novo no `visibilitychange` quando a aba volta a ficar visível;
  - ignora a falta de suporte sem erro.
- **Tela do palco:**
  - fundo escuro e fonte grande (padrão 28 px, ajustável e lembrada por aparelho);
  - topo mínimo: posição na lista ("3 de 7"), título, tom e capotraste, botões A−/A+ e transpor −/+ (grava o `targetKey` do item);
  - rodapé: Anterior / Próxima com o nome da próxima;
  - rolagem automática: liga/desliga e velocidade 1–10;
  - deslizar para os lados troca de música;
  - item sem música → mostra "Música não encontrada" e as setas pulam por cima;
  - "Sair" volta para a lista.

- [ ] **Step 1: Testes que falham**

```ts
it.each([['ArrowRight', 'ArrowRight', 'next'], ['PageDown', 'PageDown', 'next'], ['PageUp', 'PageUp', 'prev'], [' ', 'Space', 'scroll-down']])
  ('maps %s', (key, code, action) => expect(stageAction({ key, code })).toBe(action));
it('ignores keys typed into fields', () => expect(stageAction({ key: ' ', code: 'Space', targetTag: 'INPUT' })).toBeNull());
it.each([['G', 'A', 2], ['G', 'E', -3], ['C', 'F#', 6], ['Em', 'Dm', -2], ['Bb', 'Bb', 0]])('semitones %s→%s', (a, b, n) => expect(semitonesTo(a, b)).toBe(n));
```
  - `useWakeLock`: com `navigator.wakeLock` falso, pede ao montar e de novo ao voltar a ficar visível; sem `wakeLock`, não lança.
  - Página (`fake-indexeddb`): lista com 2 músicas e um item órfão → abre na primeira; `ArrowRight` vai para a segunda e pula o órfão; transpor +2 grava `targetKey`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): modo palco para culto e show`

### Task 4: Pacotes de exportação e importação

**Files:** criar `apps/web/src/lib/package.ts`, `apps/web/test/package.test.ts`; modificar `Song.tsx` ("Exportar"), `SetlistEdit.tsx` ("Exportar lista"), `Library.tsx` ("Importar").

**Interfaces — Produces:**
- `exportSongs(songIds: string[], opts: { includeAudio: boolean; setlist?: Setlist; kind: 'song' | 'setlist' | 'backup' }): Promise<Blob>` — `application/zip`.
- `readPackage(file: Blob): Promise<PackageContents>`. Lança:
  - `Error('Este arquivo não é um pacote do will-music.')` sem manifest válido;
  - `Error('Pacote de uma versão mais nova do will-music. Atualize o app.')` com `version > 1`.
- `importPackage(contents, resolve: (conflict: Song) => Promise<'replace' | 'keep-both'>): Promise<{ songs: number; setlist?: Setlist }>`. "Manter as duas" gera `id` novos e remapeia os itens da lista.
- `downloadBlob(blob, fileName)` — `<a download>`. O nome sai do título, sem acentos nem caracteres inválidos.

- [ ] **Step 1: Testes que falham** (`fake-indexeddb`)
  - exportar uma música com cifra, análise e áudio, limpar o banco e importar → tudo igual (inclusive `lineTimes` e o `Blob` do áudio, comparando o tamanho);
  - importar sobre música existente com `replace` → 1 música, conteúdo novo; com `keep-both` → 2 músicas, e a lista importada aponta para as novas;
  - zip qualquer sem manifest → erro "não é um pacote"; `version: 2` → erro "versão mais nova", nada gravado.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): exportar e importar pacotes de músicas e listas`

### Task 5: Ajustes

**Files:** criar `apps/web/src/pages/Settings.tsx`, `apps/web/src/lib/storage.ts`, `apps/web/test/storage.test.ts`; modificar `App.tsx` (rota `/ajustes`), `lib/models.ts` (`listCachedModels`, `deleteCachedModels`).

**Interfaces — Produces:**
- `formatBytes(n: number): string` — `'17 MB'`, `'850 KB'`, `'1,2 GB'`, com vírgula decimal.
- `storageStatus(): Promise<{ usage?: number; quota?: number; persisted: boolean }>` e `requestPersistence(): Promise<boolean>`.
- `listCachedModels(): Promise<{ id: ModelId; bytes: number }[]>` e `deleteCachedModels(): Promise<void>`.
- **Página de ajustes:**
  - **Tema:** claro, escuro ou sistema.
  - **Modelos baixados:** lista com tamanho e o botão "Apagar modelos". Eles voltam a ser baixados quando necessários.
  - **Armazenamento:** "Usando X de Y" e "Proteger meus dados", que chama `persist()`.
  - **Backup:** "Exportar tudo", com opção de incluir os áudios, e "Importar".
- `createSong` (Plano 2) passa a chamar `requestPersistence()` na primeira música (spec §5.4).

- [ ] **Step 1: Testes que falham**
  - `formatBytes(17080550)` → `'17 MB'`; `formatBytes(850000)` → `'850 KB'`; `formatBytes(1.2e9)` → `'1,2 GB'`;
  - `listCachedModels` com `caches` falso lista só as URLs dos `MODELS`;
  - `storageStatus` sem `navigator.storage` → `{ persisted: false }`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): página de ajustes`

### Task 6: Verificação no navegador (com o servidor do usuário)

- [ ] Montar uma lista com 3 músicas, uma delas transposta → abrir o palco no celular (DevTools com emulação de dispositivo, ou o celular real na mesma rede com `npm run dev -- --host`) → navegar pelas setas, pelo deslize e por um pedal (ou PageDown) → a tela não apaga.
- [ ] Exportar a lista com áudio, apagar os dados do site, importar → tudo volta.
- [ ] Registrar resultados no ledger. Commit — `test(web): verificação de setlists, palco e pacotes`.
