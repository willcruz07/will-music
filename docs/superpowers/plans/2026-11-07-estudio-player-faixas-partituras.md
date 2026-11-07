# Estúdio: player expansível, onda com loop, tipos de separação, MP3, partituras de teclado e bateria e som da partitura

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** a barra de reprodução recolhe e expande para cima num drawer de estudo. Ela também aparece na tela de partitura, que ganha os tipos teclado e bateria e toca o som das notas.

**O drawer tem:**
- onda da música com trecho em loop e velocidade;
- rolagem automática e a velocidade da rolagem;
- tipo de separação de faixas: voz, 4, 6 ou completa;
- mixer por faixa e exportação da mixagem em MP3.

**Pedido do usuário (2026-11-07):**
- barra recolhida (faixa + play) / expandida como drawer: rolagem automática, velocidade da rolagem, separação por instrumento com volume, mudo e "salvar um novo mp3";
- a mesma barra na tela de partituras, tocando a música ou o som da partitura;
- partitura de guitarra com tablatura, de teclado (claves de sol e fá, armadura correta) e de bateria;
- escolha do tipo de separação pelo usuário: 4, 6 ou completa (com vozes), baixando cada modelo só quando for usado;
- MP3 para economizar espaço;
- mostrar a onda da música, marcar um trecho para tocar em loop e reduzir a velocidade.

## Decisões (rulings)
- **4 e 6 faixas:** usam um único modelo, `kramp/htdemucs-6s-webgpu-onnx` rev `0c850a01007f48d94900b21b49a0d0ae1a17239f`, `htdemucs_6s.onnx`, 284797240 bytes, sha256 `a3f5050696cda4b2344d465123acb21ee699dad7d0634dba1d282497a04ac86a`, MIT.
  - É o export do HTDemucs 6s da Meta (MIT) com o `ConstantOfShape` dobrado para o WebGPU.
  - I/O verificado com onnxruntime-node: `mix` [1,2,343980] a 44,1 kHz → `stems` [1,6,2,343980], na ordem drums, bass, other, vocals, guitar, piano.
  - No modo "4", o `other` é a soma de other, guitar e piano.
  - Custo: quem quer só 4 faixas baixa 285 MB, não ~170 MB; em troca, um único download serve aos dois modos.
- **Completa:** usa o HTDemucs 6s para os instrumentos e o kara2 para dividir a voz em principal e apoio. São duas passadas sobre a mistura. A faixa `vocals` do Demucs é descartada.
- **Bateria:**
  - a partitura de bateria vem de onsets por banda de frequência na faixa `drums` (bumbo, caixa e chimbal);
  - não usa modelo: o DrumSep exige STFT externo e tem licença incerta;
  - exige uma separação de 4, 6 ou completa.
- **Teclado:**
  - Basic Pitch polifônico na faixa `piano`; sem ela, na `other`; sem separação, na música inteira;
  - divisão das mãos no dó central (MIDI 60);
  - a guitarra continua sendo a melodia com TAB.
- **Armazenamento das faixas:**
  - faixas novas são gravadas em MP3 de 192 kbps via `wasm-media-encoders`, com MIT no npm e o LAME compilado em wasm;
  - o Demucs codifica em streaming; o kara2 codifica no fim;
  - as faixas antigas em WAV continuam tocando.
- **Várias separações por música:** nova tabela Dexie `stemSets` com chave `[songId+mode]`. A v5 migra a tabela `stems` antiga (modo `vocals`) e a v6 apaga a tabela antiga.
- **Player:**
  - continua por página (Música e Partitura); não há player global entre telas;
  - a posição fica em `sessionStorage` e é retomada, pausada, na outra tela.
- **Som da partitura:** sintetizador Web Audio próprio (sem samples), com triângulo, envelope e ruído para a bateria. Ele toca sincronizado com o relógio do player e respeita a velocidade.
- **Onda:**
  - picos calculados uma vez (decodificação a 8 kHz mono, 1200 colunas) e guardados na tabela `peaks`;
  - arrastar marca o trecho A–B;
  - tocar sem arrastar leva para aquele ponto.

## Review Focus
- Música mais curta que um bloco do Demucs (7,8 s); a costura entre blocos sem cliques.
- Memória: 6 faixas de uma música de 6 minutos não podem ficar todas em float na memória (streaming).
- Trocar de tipo de separação enquanto outra roda; apagar uma separação que está tocando.
- Loop marcado de trás para frente na onda; loop curto (< 0,5 s).
- Partitura de bateria sem a faixa de bateria; teclado sem notas.

## Tarefas
1. **Motor:**
   - acumulador em streaming (`separation/streaming.ts`);
   - modos e combinação de fontes (`separation/demucs.ts`);
   - onsets de bateria (`score/drums.ts`);
   - picos da onda (`audio/peaks.ts`);
   - MusicXML de teclado e de bateria (`score/parts.ts`).
2. **App, dados e workers:**
   - Dexie v5 e v6;
   - `stems.ts` multi-modo;
   - worker de separação com modos e MP3;
   - exportação da mixagem em MP3;
   - picos;
   - nomes dos modelos e "Baixar todos os modelos" em Ajustes.
3. **App, UI:**
   - Player recolhido / drawer com onda, loop, velocidade, rolagem, faixas e exportação;
   - página da música;
   - página da partitura com o player, os tipos (melodia, guitarra+TAB, teclado, bateria) e o som da partitura.
