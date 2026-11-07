# Editor de cifra, sincronia e diagramas — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O usuário corrige a cifra gerada (texto e acordes), ajusta o tempo das linhas tocando junto, edita os dados da música e vê como tocar cada acorde no violão e no teclado, inclusive o acorde atual durante a música.

**Architecture:** O tempo das linhas passa a morar na cifra (`Chart.lineTimes`), conforme o spec §5.5. Ao salvar uma edição, os tempos são remapeados por correspondência de linhas (LCS sobre o texto da letra sem acordes). Linhas novas recebem tempo por interpolação. O editor é um textarea ChordPro com pré-visualização (`ChartView`). Os diagramas de violão vêm do `@tombatossals/chords-db` e são desenhados com `svguitar`; o teclado é um SVG próprio calculado a partir das notas do acorde.

**Tech Stack:** o do Plano 2 + `svguitar` (MIT) e `@tombatossals/chords-db` (MIT).

**Spec:** [`docs/superpowers/specs/2026-11-06-will-music-v1-design.md`](../specs/2026-11-06-will-music-v1-design.md) — §5.1 (Chart), §5.5, §7.6 (editor, diagramas), §7.8 (loop A-B, diagrama do acorde atual).

## Global Constraints

- Tudo dos Planos 1 e 2 vale.
- **Cifra editada nunca é sobrescrita** sem confirmação (spec §5.5). `origin` vira `'edited'` no primeiro salvamento do editor.
- O ChordPro exportável continua padrão: os tempos ficam em `Chart.lineTimes`, fora do texto.
- **Tamanho:** os diagramas do violão são carregados sob demanda (`import()` dinâmico do JSON de violão do chords-db), sem pesar a abertura do app.
- **Grafia dos acordes no editor:** o usuário digita na notação brasileira (`C7M`, `F#m7(b5)`, `D/F#`, `G4`); a transposição (Plano 2) e os diagramas precisam aceitar essa notação.

## Review Focus

1. **Edição que apaga, junta ou divide linhas** → linhas inalteradas mantêm o tempo e as novas são interpoladas, sem quebrar o destaque. Teste na Task 1.
2. **Acorde digitado que o app não conhece** (`Xyz`, `C7(#9)`, `Bbsus4/Ab`) → o diagrama mostra "sem diagrama" em vez de quebrar; a transposição mantém o sufixo. Testes nas Tasks 5 e 6.
3. **Modo sincronizar interrompido** (pausa, voltar, sair da tela) → os tempos já marcados ficam salvos e os demais permanecem como estavam. Teste na Task 3.
4. **Loop A-B com B antes de A, ou fora da duração** → normalizado ou ignorado, sem travar o player. Teste na Task 7.
5. **Cifra criada à mão sem áudio** → o editor funciona, sem player nem sincronizar. Teste na Task 2.

---

### Task 1: Tempo das linhas na cifra

**Files:** criar `apps/web/src/lib/lineTimes.ts`, `apps/web/test/lineTimes.test.ts`; modificar `apps/web/src/lib/db.ts`, `apps/web/src/lib/pipeline.ts`, `apps/web/src/lib/lyricsApply.ts`, `apps/web/src/pages/Song.tsx`.

**Interfaces — Produces:**
- `Chart.lineTimes?: (number | null)[]` — um item por linha de letra (`kind: 'lyric'`) do `chordPro`, na ordem.
- `db` versão 2: o upgrade preenche `lineTimes` com os tempos de `analysis.lyrics.lines` para as cifras `generated`.
- `lyricTexts(chordPro: string): string[]` — texto de cada linha de letra sem acordes e com espaços normalizados.
- `remapLineTimes(oldChordPro: string, newChordPro: string, oldTimes: (number | null)[]): (number | null)[]`.
  - Correspondência por LCS dos textos.
  - Dentro de um trecho alterado com o mesmo número de linhas, o tempo é mantido por posição (edição de palavra numa linha mantém o tempo).
  - O resto vira `null`.
- `resolveLineTimes(times: (number | null)[]): number[]` — interpola os `null` entre os vizinhos conhecidos, extrapolando 4 s por linha nas pontas e mantendo a ordem crescente.
- Geração e aplicação de letra (`pipeline.ts`, `lyricsApply.ts`) passam a gravar `lineTimes`. A tela da música usa `resolveLineTimes(chart.lineTimes)` em vez de `analysis.lyrics.lines`.

- [ ] **Step 1: Testes que falham**

```ts
const before = '[G]um\n[D]dois\ntrês\nquatro';
it('keeps times of unchanged and edited-in-place lines', () => {
  expect(remapLineTimes(before, '[G]um\n[C]dois!\ntrês\nquatro', [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
});
it('drops deleted lines and nulls inserted ones', () => {
  expect(remapLineTimes(before, '[G]um\ntrês\nnova\nquatro', [1, 2, 3, 4])).toEqual([1, 3, null, 4]);
});
it('interpolates missing times', () => {
  expect(resolveLineTimes([1, null, null, 7])).toEqual([1, 3, 5, 7]);
  expect(resolveLineTimes([null, 10, null])).toEqual([6, 10, 14]);
  expect(resolveLineTimes([null, null])).toEqual([0, 4]);
});
it('ignores chords and comments when matching', () => {
  expect(lyricTexts('{comment: Intro}\n[G] [D]\n[G]Nin[D]guém  explica')).toEqual(['Ninguém explica']);
});
```
- [ ] **Step 2–4:** falhar → implementar (incluir o upgrade do Dexie e um teste do upgrade com `fake-indexeddb`: um banco v1 com chart + analysis abre em v2 com `lineTimes` preenchido) → passar.
- [ ] **Step 5: Commit** — `feat(web): tempo das linhas guardado na cifra`

### Task 2: Editor de cifra

**Files:** criar `apps/web/src/pages/EditChart.tsx`, `apps/web/src/lib/history.ts`, `apps/web/test/editChart.test.tsx`, `apps/web/test/history.test.ts`; modificar `App.tsx` (rota `/musica/:id/editar`), `Song.tsx` (botão "Editar cifra"), `Library.tsx`/`NewSong.tsx` (opção "Criar cifra sem áudio").

**Interfaces — Produces:**
- `createHistory(initial: string)`: `{ value; set(v); undo(); redo(); canUndo; canRedo }` — agrupa digitação contínua em uma entrada a cada 600 ms de pausa.
- `saveEditedChart(songId: string, chordPro: string): Promise<void>` — remapeia `lineTimes` (Task 1) e grava `origin: 'edited'`.
- `restoreGeneratedChart(songId: string): Promise<void>` — reconstrói a cifra a partir da análise atual depois de `confirm()` e volta a `origin: 'generated'`.
- `createManualSong(title: string, artist: string): Promise<Song>` — música sem áudio, `analysisStatus: 'done'`, cifra vazia `origin: 'manual'`.
- Tela do editor:
  - textarea ChordPro (fonte monoespaçada só aqui, para alinhar o texto bruto) com pré-visualização ao lado no computador e em abas "Texto | Ver" no celular;
  - botões Desfazer, Refazer, Salvar e Cancelar;
  - atalhos Ctrl+Z, Ctrl+Shift+Z e Ctrl+S;
  - aviso ao sair com alterações não salvas;
  - ajuda curta da sintaxe: "Acordes entre colchetes antes da sílaba: `[G]Ninguém explica`".

- [ ] **Step 1: Testes que falham**
  - `history`: `set('a')`, `set('ab')` dentro de 600 ms viram uma entrada; `undo()` volta ao inicial; `redo()` reaplica.
  - Editor (`MemoryRouter` + `fake-indexeddb`): digitar e clicar em Salvar grava o `chordPro` e `origin: 'edited'`, e volta para `/musica/:id`.
  - Música manual sem áudio: o editor abre e a tela da música não mostra player.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): editor de cifra com desfazer e refazer`

### Task 3: Modo sincronizar

**Files:** criar `apps/web/src/lib/syncSession.ts`, `apps/web/test/syncSession.test.ts`; modificar `Song.tsx` e `Player.tsx`.

**Interfaces — Produces:**
- `createSyncSession(lineCount: number, start: (number | null)[])` com:
  - `next`: índice da próxima linha;
  - `mark(t)`: grava `t` na linha `next` e avança;
  - `back()`: volta uma linha e desfaz a marca;
  - `times`.
- Botão "Sincronizar" na barra da música:
  - toca do início e mostra "Toque na tela ou aperte espaço no início de cada linha" com a linha alvo destacada;
  - `mark` a cada toque ou espaço; seta para a esquerda faz `back`;
  - "Concluir" ou sair da tela salva os tempos marcados em `Chart.lineTimes`, sem mudar `origin`.

- [ ] **Step 1: Testes que falham** — `mark(1.5)` e `mark(4)` gravam as linhas 0 e 1; `back()` limpa a 1 e `next` volta a 1; `mark` além da última linha não faz nada; os tempos não marcados mantêm os valores de `start`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): modo sincronizar a letra tocando`

### Task 4: Editar dados da música

**Files:** criar `apps/web/src/components/SongInfoForm.tsx`, `apps/web/test/songInfo.test.tsx`; modificar `Song.tsx`.

**Interfaces — Produces:**
- `SongInfoForm({ song, onSave })` com os campos título, artista, capotraste (0–11), andamento (BPM) e compasso.
- Salvar usa `updateSong`, e o cabeçalho da cifra (`{title}`, `{artist}`) acompanha via `setChordProMeta(chordPro, meta)`, que substitui as diretivas sem tocar no resto.
- O capotraste aparece ao lado do tom ("Tom G · Capo 2").

- [ ] **Step 1: Testes que falham**
  - `setChordProMeta('{title: a}\n[G]x', { title: 'b', artist: 'c' })` retorna `'{title: b}\n{artist: c}\n[G]x'`.
  - O formulário salva os valores editados.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): editar dados da música`

### Task 5: Inserir acorde tocando na palavra

**Files:** modificar `ChartView.tsx` (modo `editable`), `EditChart.tsx`; criar `apps/web/src/lib/chordProEdit.ts`, `apps/web/test/chordProEdit.test.ts`.

**Interfaces — Produces:**
- `setChordAt(chordPro: string, lyricLineIndex: number, charIndex: number, chord: string | null): string` — insere, troca ou remove (`null`) o acorde na posição da letra.
- Na aba "Ver" do editor, tocar numa sílaba abre um campo com sugestões (acordes já usados na música) e "Remover acorde".
- `isKnownChord(text: string): boolean` — aceita a notação brasileira (`C`, `Cm`, `C7`, `C7M`, `Cm7(b5)`, `C°`, `C+`, `C4`, `Csus4`, `C9`, `C/E` …) e alerta ("acorde não reconhecido") sem impedir de salvar.

- [ ] **Step 1: Testes que falham**

```ts
it('inserts, replaces and removes a chord', () => {
  expect(setChordAt('Ninguém explica', 0, 8, 'D')).toBe('Ninguém [D]explica');
  expect(setChordAt('Ninguém [D]explica', 0, 8, 'Em')).toBe('Ninguém [Em]explica');
  expect(setChordAt('[G]Ninguém [D]explica', 0, 8, null)).toBe('[G]Ninguém explica');
});
it.each(['C7M', 'F#m7(b5)', 'D/F#', 'G4', 'C°', 'Bb9'])('knows %s', (c) => expect(isKnownChord(c)).toBe(true));
it.each(['Xyz', 'H7', ''])('rejects %s', (c) => expect(isKnownChord(c)).toBe(false));
```
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): inserir e trocar acordes tocando na letra`

### Task 6: Diagramas de acorde (violão e teclado)

**Files:** criar `apps/web/src/lib/chordShapes.ts`, `apps/web/src/components/ChordDiagram.tsx`, `apps/web/src/components/ChordPanel.tsx`, `apps/web/test/chordShapes.test.ts`; modificar `Song.tsx`, `Player.tsx`.

**Interfaces — Produces:**
- `chordNotes(chord: string): number[] | null` — classes de altura (raiz primeiro) a partir da notação brasileira.
  - Qualidades: maior, menor, 7, 7M, m7, m(7M), 6, m6, °, °7, m7(b5), +, sus2/2, sus4/4, 9/add9, m9, 7(9), 7M(9), 11, 13; o baixo após `/` vai antes, se for diferente da raiz.
  - Desconhecido → `null`.
- `guitarShape(chord: string): Promise<{ frets: number[]; fingers: number[]; baseFret: number; barres: number[] } | null>`.
  - Mapeia a notação para a chave do chords-db: raiz `C#`→`Csharp`, `Bb`→`Bb` (o banco usa `Csharp`, `Eb`, `F#`… normalizar enarmônicos para as chaves existentes); sufixo `m`→`minor`, `7M`→`maj7`, `m7(b5)`→`m7b5`, `°`→`dim`, `°7`→`dim7`, `4`/`sus4`→`sus4`, `/E`→`/E`.
  - Devolve a primeira posição; desconhecido → `null`.
- `ChordDiagram({ chord, instrument: 'violao' | 'teclado' })`:
  - **violão:** `svguitar` com cores dos tokens do tema;
  - **teclado:** SVG de 2 oitavas com as notas destacadas em esmeralda;
  - **sem forma:** "Sem diagrama para {chord}".
- `ChordPanel`: acordes distintos da cifra (já transpostos), em ordem de aparição, com a escolha violão/teclado lembrada em `localStorage`.
- Durante a reprodução, o diagrama do **acorde atual** aparece no rodapé, ao lado do player, e pode ser escondido.

- [ ] **Step 1: Testes que falham**

```ts
it.each([['Cm7', [0, 3, 7, 10]], ['D/F#', [6, 2, 9]], ['G7M(9)', [7, 11, 2, 6, 9]], ['F#m7(b5)', [6, 9, 0, 4]], ['A4', [9, 2, 4]]])
  ('notes of %s', (c, notes) => expect(chordNotes(c)).toEqual(notes));
it('returns null for unknown chords', () => expect(chordNotes('Xyz')).toBeNull());
it('finds guitar shapes for common chords', async () => {
  expect((await guitarShape('C'))!.frets).toEqual([-1, 3, 2, 0, 1, 0]);
  expect(await guitarShape('C#m7')).not.toBeNull();
  expect(await guitarShape('Xyz')).toBeNull();
});
```
- [ ] **Step 2–4:** falhar → implementar → passar. Conferir no `chords-db` as chaves reais dos sufixos antes de fixar a tabela (ler `lib/guitar.json`).
- [ ] **Step 5: Commit** — `feat(web): diagramas de acorde no violão e no teclado`

### Task 7: Loop A-B no player

**Files:** modificar `Player.tsx`; criar `apps/web/src/lib/loop.ts`, `apps/web/test/loop.test.ts`.

**Interfaces — Produces:**
- `normalizeLoop(a: number | null, b: number | null, duration: number): { a: number; b: number } | null` — ordena A e B, limita à duração e exige B − A ≥ 1 s.
- No player: botões "Marcar A" / "Marcar B" / "Limpar loop". Com loop ativo, ao passar de B volta para A. A barra de tempo mostra a faixa do loop.

- [ ] **Step 1: Testes que falham**
  - `normalizeLoop(10, 5, 100)` → `{ a: 5, b: 10 }`;
  - `normalizeLoop(95, 120, 100)` → `{ a: 95, b: 100 }`;
  - `normalizeLoop(5, 5.5, 100)` → `null`;
  - `normalizeLoop(null, 10, 100)` → `null`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): loop A-B no player`

### Task 8: Verificação em navegador

- [ ] Com o servidor rodando (o usuário inicia `npm run dev`), percorrer:
  1. editar uma cifra gerada (trocar um acorde por toque, apagar uma linha) e salvar → os tempos das outras linhas se mantêm no play;
  2. sincronizar a letra colada de "Primeiros Passos" → a linha destacada acompanha a música;
  3. diagramas de violão e teclado do acorde atual durante o play;
  4. loop A-B num trecho.
- [ ] Registrar resultados e capturas no ledger; corrigir com teste que reproduz antes. Commit — `test(web): verificação do editor e diagramas`.
