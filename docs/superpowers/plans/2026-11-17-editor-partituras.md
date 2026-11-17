# Editor de partituras — plano de implementação

> Execução: nativa, nesta sessão. Verificação por typecheck + build e validação no navegador pelo usuário (preferência do projeto; sem etapas de testes automatizados).

**Objetivo:** partituras escritas (uma pauta, piano, bateria) com editor, modo de estudo com sons de instrumento, compartilhamento por link e edição da partitura gerada pela IA.

**Arquitetura:** modelo próprio `Sheet` (fonte da verdade, `lib/sheet/model.ts`) → MusicXML (`lib/sheet/musicxml.ts`) → alphaTab (`AlphaTabApi.load`) para desenhar, tocar (SoundFont sonivox), cursor, loop e velocidade. O mesmo MusicXML serve para exportar. Edição em funções puras sobre o modelo (`lib/sheet/edit.ts`), com histórico de desfazer.

**Spec:** `docs/superpowers/specs/2026-11-17-editor-partituras-design.md`

## Restrições globais

- Semibreve = 96 tiques; compasso sempre cheio; `measureRest` vale o compasso.
- alphaTab 1.9.0 + `@coderline/alphatab-vite` (fonte Bravura e `soundfont/sonivox.sf2` copiados no build); carregado só nas telas de partitura.
- Bateria: canal 10 General MIDI — kick 36, snare 38, hihatClosed 42, hihatOpen 46, tomHigh 50, tomMid 47, tomFloor 43, crash 49, ride 51.
- Sons (programa GM, base 1 no MusicXML): piano 1, guitar 25 (violão nylon), bass 34 (baixo elétrico dedo), melody 74 (flauta).
- Nada no app cita outros programas.

## Tarefas

1. **Modelo e MusicXML** — `lib/sheet/model.ts` (tipos, tiques, criação, `measureTicks`, `eventTicks`), `lib/sheet/musicxml.ts` (`sheetToMusicXml(sheet, { noteNames?: boolean })`).
2. **Edição** — `lib/sheet/edit.ts`: cursor `{ staff, measure, event }`, `placeEvent` (substitui, divide, liga ao próximo compasso, completa com pausas), `deleteAt` (vira pausa), `setPitch`, `addChordPitch`, `shiftSemitone`, `shiftOctave`, `toggleDot`, `toggleTie`, `makeTriplet`, `toggleArticulation`, `setDynamic`, `setChordSymbol`, `setFingering`, `addMeasures`, `removeMeasure`; `createHistory` reaproveitado.
3. **Armazenamento** — Dexie v9: `sheets` e `sharedSheets`; `lib/sheet/store.ts` (`listSheets`, `getSheet`, `saveSheet`, `deleteSheet`).
4. **Visualização e reprodução** — `components/sheet/SheetView.tsx` (AlphaTabApi, render, cursor de reprodução, `boundsLookup` para clique → cursor de edição), `useSheetPlayer` (tocar, velocidade, loop por compassos, contagem, metrônomo, prévia de nota).
5. **Editor** — página `/partitura/:id` (`pages/SheetEditor.tsx`): barra de figuras, teclado de piano/peças de bateria, paleta (articulações, dinâmica, cifra, dedilhado), atalhos, compassos, desfazer, salvar automático, exportar MusicXML, imprimir.
6. **Assistente** — `components/sheet/NewSheetWizard.tsx` em `/partitura/nova`.
7. **Estudo** — `/partitura/:id/estudar` (`pages/SheetStudy.tsx`): tocar, velocidade 25–150%, loop, contagem, metrônomo, nomes das notas, instruções.
8. **Biblioteca** — aba Partituras lista partituras escritas + "Nova partitura" + "Compartilhadas comigo".
9. **Compartilhar** — `lib/cloud/sheets.ts` (`publishSheet`, `unpublishSheet`, `openSharedSheet`), rota `/partitura/compartilhada/:id`, estado "alterações não publicadas"; regras em `docs/firebase-partituras.md`.
10. **Editar partitura da IA** — `lib/sheet/fromScore.ts` (`scoreToSheet(type, scoreRecord, analysis, range)`), botão Editar no Estúdio (`StudioScores`) e na página da partitura salva (`SongScore`), diálogo de trecho.
11. **Verificação** — `npx tsc -p apps/web`; `npm run build -w @will-music/web`.
