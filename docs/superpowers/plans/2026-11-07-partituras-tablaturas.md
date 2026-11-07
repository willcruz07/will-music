# Partituras e tablaturas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** para cada música, gerar uma partitura de melodia com cifra (lead sheet) e uma tablatura de violão, ver na tela e exportar MusicXML (abre no MuseScore).

**Architecture:**
- **Transcrição:** o Basic Pitch (Spotify, Apache-2.0, ONNX de 230 KB) transcreve as notas da voz principal separada, ou da mistura quando não há faixas separadas.
- **Melodia:** o motor (TS puro) extrai as notas das probabilidades, reduz a uma melodia monofônica, estima o andamento e quantiza em semicolcheias.
- **MusicXML:** monta a partitura com os acordes da análise e uma pauta de TAB com casas atribuídas por programação dinâmica.
- **App:** o app guarda as notas brutas no Dexie (v4, tabela `scores`) e monta o MusicXML na hora. O OpenSheetMusicDisplay (BSD-3) desenha a partitura.

**Tech Stack:** TS puro (engine), onnxruntime-web wasm, Dexie, React, OpenSheetMusicDisplay.

**Spec:** docs/superpowers/specs/2026-11-06-will-music-v1-design.md (partitura/tab = fase V1.1, roadmap). O pedido do usuário em 2026-11-07 foi "implementar o módulo para partituras e tablaturas".

## Global Constraints
- Tudo roda no navegador; nada de servidor. Modelos fixados por revisão + SHA-256 em `MODELS`.
- engine sem DOM e sem `node:`. Textos de UI em pt-BR.
- Basic Pitch: `daserge/basic-pitch-onnx` rev `2633e680fb5a1c551cee4905410115b6715862f6`, `nmp.onnx`, 230444 bytes, sha256 `2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec`.
- **Entrada:** `serving_default_input_2:0` com shape [1, 43844, 1], 22050 Hz mono.
- **Saídas:** `StatefulPartitionedCall:1` = note [1,172,88] e `:2` = onset [1,172,88]; o `:0` (contour) é ignorado. A ordem foi verificada com onnxruntime-node.
- **Janelas:**
  - pad inicial de 3840 amostras; janela de 43844 amostras; hop de 36164 amostras;
  - descartar 15 frames no início e 15 no fim de cada janela;
  - total de frames = floor(len/256); frame = 256/22050 s; bin 0 = MIDI 21.

## Review Focus
- Áudio menor que uma janela (10 s ou menos) e áudio silencioso: deve gerar uma partitura vazia válida (só pausas), sem quebrar.
- Notas que cruzam a barra de compasso devem ser divididas com ligadura; durações estranhas (5, 7, 11 semicolcheias) viram figuras ligadas válidas.
- Notas fora da extensão do violão: transpor por oitavas para caber em E2–casa 15 da corda 1.
- Acordes N/X não viram `<harmony>`.
- Apagar a música também apaga a partitura.

---

### Task 1: Basic Pitch no motor (janelas + notas + melodia)
**Files:**
- Create: `packages/engine/src/score/basicPitch.ts`, `packages/engine/src/score/notes.ts`
- Test: `packages/engine/test/score.test.ts`
- Modify: `packages/engine/src/models.ts` (adicionar `basicPitch`), `packages/engine/src/index.ts`

**Produces:**
- `BASIC_PITCH` (constantes)
- `runBasicPitch(pcm22050: Float32Array, runner: TensorRunner, onProgress?): Promise<Posteriors>`, com `Posteriors = { frames: number; note: Float32Array; onset: Float32Array }` (frames×88)
- `extractNotes(p: Posteriors, opts?): NoteEvent[]`, com `NoteEvent = { pitch: number; start: number; end: number; velocity: number }` em segundos
- `toMelody(notes, { minPitch=45, maxPitch=84 }): NoteEvent[]`

**Algoritmo de `extractNotes`** (versão simplificada do `output_to_notes_polyphonic` do Basic Pitch):
- picos locais de onset ≥ 0,5;
- a nota segue enquanto `note` ≥ 0,3, tolerando até 11 frames abaixo do limiar;
- duração mínima de 11 frames;
- velocity = média de `note`;
- processa do fim para o começo e zera o que já foi usado, como no original.

**`toMelody`:** filtra pela extensão; em sobreposições fica a nota de maior velocity × duração; a anterior é truncada no início da seguinte.

**Testes:**
- janelamento chama o runner ceil((len+3840)/36164) vezes e devolve floor(len/256) frames;
- a costura pega os frames centrais (runner falso com valor = índice da janela);
- uma rampa sintética de onset+note no bin 39 (MIDI 60) por 50 frames gera 1 nota MIDI 60 com duração ≈ 50·256/22050;
- nota curta (5 frames) é descartada;
- duas notas sobrepostas viram melodia sem sobreposição.

### Task 2: andamento, quantização, MusicXML e tablatura
**Files:**
- Create: `packages/engine/src/score/{tempo,quantize,musicxml,tab}.ts`
- Test: `packages/engine/test/scoreXml.test.ts`

**Produces:**
- `estimateTempo(onsets: number[]): number`: autocorrelação de trem de pulsos a 100 Hz, entre 70 e 160 BPM; com menos de 4 notas devolve 100.
- `quantize(notes, bpm): QNote[]`, com `QNote = { pitch; start; dur }` em semicolcheias. A fase escolhida é a que maximiza os onsets alinhados; sem sobreposição; dur ≥ 1.
- `assignFrets(pitches, tuning = [64,59,55,50,45,40]): { string: number; fret: number }[]`. A corda 1 é o mi agudo, a casa máxima é 15, e a DP minimiza |Δcasa| mais uma penalidade de casa alta. Notas fora da extensão sobem ou descem oitavas.
- `chordsToHarmony(segments, bpm, offsetSec)`: segmentos → `{ tick; root; kind }`.
- `buildMusicXml({ title, artist, bpm, key: KeyResult|undefined, notes: QNote[], harmonies, tab: boolean }): string`:
  - MusicXML 4.0 partwise, 4/4, divisions = 4;
  - parte P1 "Melodia" em clave de sol;
  - parte P2 "Violão" com clave TAB, 6 linhas, afinação e `<technical><string/><fret/>`;
  - armadura pelo tom (menor = relativa maior); grafia ♯ ou ♭ conforme a armadura.

**Testes:**
- tempo 120 BPM a partir de onsets a cada 0,5 s;
- `quantize` encaixa onsets com jitter de ±30 ms;
- uma nota de 6 semicolcheias começando no tick 14 se divide em 2 + 4 com `<tie>`;
- uma duração de 5 semicolcheias vira 4 + 1 ligadas;
- compasso vazio = pausa de semibreve;
- C:maj7 → `<kind>major-seventh</kind>`;
- `N` é ignorado;
- armadura de Bb maior = -2 e Lá menor = 0;
- o XML é bem-formado (DOMParser no jsdom ou checagem de tags balanceadas);
- `assignFrets` prefere a mesma região da escala; MIDI 40 → corda 6, casa 0; MIDI 30 sobe uma oitava.

### Task 3: worker, armazenamento e telas
**Files:**
- Create:
  - `apps/web/src/worker/transcription.worker.ts`
  - `apps/web/src/lib/score.ts`
  - `apps/web/src/pages/Scores.tsx` (/partituras)
  - `apps/web/src/pages/SongScore.tsx` (/musica/:id/partitura)
  - `apps/web/src/components/ScoreView.tsx` (OSMD)
- Modify:
  - `db.ts`: v4 `scores: 'songId'`; tipo `ScoreRecord = { songId, notes: NoteEvent[], bpm, source: 'lead'|'mix', model, createdAt }`; `deleteSong` também apaga a partitura.
  - `App.tsx` (rotas), `Song.tsx` (link "Partitura" na barra), `package.json` (opensheetmusicdisplay).
- Tests: `apps/web/test/score.test.ts`
  - `buildSongScore` gera XML com o título e os acordes;
  - `deleteSong` apaga `scores`;
  - a página /partituras lista as músicas com e sem partitura;
  - a página da partitura mostra "Gerar partitura" quando não existe.

**Fluxo:**
- `transcribeMelody(songId, onProgress)` decodifica a 22050 Hz mono (voz principal, se houver faixas separadas; senão a mistura) e chama o worker, que faz `fetchModel('basicPitch')` → `runBasicPitch` → `extractNotes` → `toMelody`.
- O BPM vem de `song.tempo`; se não houver, de `estimateTempo`.
- Grava em `scores`.

**Página:**
- ScoreView com OSMD importado de forma lazy;
- botões: Tablatura liga/desliga, BPM editável (requantiza), Baixar MusicXML e Gerar de novo.
