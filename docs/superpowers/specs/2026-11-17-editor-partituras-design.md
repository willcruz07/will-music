# Editor de partituras: escrever, ensinar e estudar

Data: 17/11/2026. Status: desenho para aprovação.

## Intenção

Um professor de música precisa escrever, rápido e no celular ou no computador, uma partitura que o aluno consiga usar; o aluno precisa ouvir, desacelerar, repetir e aprender a ler aquela partitura. Hoje o will-music só **exibe** partituras geradas pela IA (OSMD, só leitura, grade de semicolcheias em 4/4, sem tercinas, articulações ou dinâmica). Este projeto acrescenta um editor e um modo de estudo, produtivos para ensino, sem tentar ser um programa de editoração profissional.

Regras do usuário: não citar outros programas dentro do app; não copiar código de nenhum projeto; só entra o que ajuda professor e aluno.

## Metas

- **Três tipos de pauta**: uma pauta (clave de sol ou fá), piano (duas pautas, sol + fá) e bateria (pauta de percussão).
- **Escrever do zero** com um assistente curto e **editar a partitura gerada pela IA** no Estúdio.
- **Entrada rápida**: figura antes da nota, compassos sempre cheios, atalhos no teclado do computador e barra de toque no celular.
- **Elementos didáticos**: figuras de semibreve a semicolcheia, ponto, ligadura, pausas, tercinas, acidentes, acordes (várias notas juntas), armadura, fórmula de compasso, andamento, acento, staccato, tenuto, fermata, dinâmicas (pp a ff), cifra acima, dedilhado (números) e texto de instrução.
- **Sons de instrumento** na reprodução: piano, violão/guitarra, baixo, voz/flauta (som simples de melodia) e kit de bateria (bumbo, caixa, chimbal fechado/aberto, tons agudo/médio/surdo, prato de ataque, prato de condução).
- **Modo de estudo para o aluno**: tocar com a nota destacada, andamento de 25% a 150%, repetir um trecho de compassos, contagem inicial e metrônomo, mostrar/esconder nome das notas.
- **Professor → aluno**: compartilhar por link; o aluno abre, estuda e pode salvar uma cópia.
- Funciona offline depois do primeiro uso (biblioteca e sons guardados no aparelho); o compartilhamento exige conexão.

## Fora do escopo (primeira versão)

- Mais de uma voz na mesma pauta (o piano usa uma voz por mão).
- Letra sílaba por sílaba, tablatura editável, partes extraídas, layout de página e impressão com diagramação própria.
- Repetições com casas (D.C., D.S., coda), mudança de compasso ou armadura no meio da peça, quiálteras além de tercinas.
- Avaliação do aluno pelo microfone.
- Edição colaborativa em tempo real.

## Antimetas

- Virar um editor complexo que um professor não consegue usar no celular em poucos minutos.
- Compasso "quebrado" (duração somada diferente da fórmula) em qualquer momento da edição.
- Som ou desenho diferentes do que está escrito (o que o aluno ouve tem de ser o que está na pauta).
- Citar ou imitar a interface de outro programa.

## Restrições

- PWA no navegador, React 19 + Vite; celular é público principal do aluno.
- Firestore cobra por leitura: abrir uma partitura compartilhada custa 1 leitura (ver memória do projeto).
- Bundle: a biblioteca de partitura e os sons carregam só nas telas do editor e do estudo.
- Licenças compatíveis com app livre.

## Abordagens consideradas

1. **Editor próprio sobre VexFlow (MIT)**: controle total, mas desenho de piano/bateria, cursor, repetição, velocidade e sons ficam por nossa conta. Caminho mais longo.
2. **alphaTab (MPL-2.0) como motor de desenho e reprodução, editor e modelo próprios por cima (escolhida)**. A versão 1.9.0 traz, confirmado na documentação: pauta comum, tablatura, percussão, piano com duas pautas, sintetizador com SoundFont incluso (sonivox.sf2, ~1,35 MB), cursor da batida, repetição (`isLooping`, `playbackRange`), velocidade (`playbackSpeed`), contagem (`countInVolume`), metrônomo (`metronomeVolume`), cliques e seleção na partitura (`boundsLookup`), construção da partitura por código e importação de MusicXML.
3. **Verovio (LGPL-3, WASM)**: melhor gravação visual, mas tocador, sons e edição seriam nossos.

Escolha: abordagem 2, decidida pelo Claude com liberdade dada pelo usuário. Motivo: o que mais importa para o aluno (ouvir com o instrumento certo, ver a nota, desacelerar, repetir) vem pronto; o esforço vai na edição simples e no fluxo professor → aluno.

## Modelo de dados

O app tem **modelo próprio** como fonte da verdade (independente da biblioteca de desenho), convertido para o alphaTab ao desenhar/tocar e para MusicXML ao exportar.

```text
Sheet {
  id, title, author (nome do professor), instructions?,
  staffType: 'single' | 'piano' | 'drums',
  clef?: 'treble' | 'bass'            // só em single
  clefOctave?: 0 | -1                 // -1 = clave com 8 embaixo (violão/guitarra e baixo soam como escrito na leitura convencional)
  sound: 'piano' | 'guitar' | 'bass' | 'melody' | 'drums',
  keyFifths: -7..7, timeSignature: { beats, unit },  // unit 2|4|8
  tempo: number (BPM da unidade da fórmula),
  staves: Staff[]                     // single/drums: 1; piano: 2 (direita, esquerda)
  songId?: string                     // quando veio de uma música do Estúdio
  createdAt, updatedAt
}
Staff { measures: Measure[] }          // todas as pautas têm o mesmo número de compassos
Measure { events: Event[] }            // soma das durações = fórmula de compasso (sempre)
Event {
  kind: 'note' | 'rest' | 'measureRest', // measureRest: pausa de compasso inteiro, vale o compasso em qualquer fórmula
  duration: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth',
  dots: 0 | 1, triplet?: true,         // tercina: três eventos seguidos da mesma figura marcados (tercinas mistas ficam fora desta versão)
  pitches?: Pitch[]                    // várias = acorde; em bateria, peças do kit
  tieToNext?: true,
  articulations?: ('accent' | 'staccato' | 'tenuto' | 'fermata')[],
  dynamic?: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff',
  chordSymbol?: string
}
Pitch = { step: 'C'..'B', alter: -1|0|1, octave, fingering?: string } |   // dedilhado por nota (acordes de piano)
        { drum: 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'tomHigh' | 'tomMid' | 'tomFloor' | 'crash' | 'ride' }
```

- Duração em "tiques" interna: semibreve = 96 (cabem semicolcheia pontuada e tercinas de colcheia/semínima sem frações).
- Guardado no IndexedDB em uma tabela nova `sheets` (Dexie, versão nova do banco) e sincronizável depois como os outros registros (UUID + `updatedAt`).

## Comportamento

### Biblioteca

- A aba **Partituras** da biblioteca lista as partituras geradas já salvas (como hoje) e as partituras escritas, com botão **Nova partitura**.

### Assistente "Nova partitura"

- Passos curtos: tipo (uma pauta, piano, bateria) → som (para uma pauta: piano, violão/guitarra, baixo, melodia; clave sugerida pelo som, com troca) → tom (armadura) → fórmula (2/4, 3/4, 4/4, 6/8, 2/2) → andamento → número de compassos (padrão 8) → título e autor.
- Cria a partitura com todos os compassos cheios de pausas de compasso inteiro (`measureRest`).
- Para violão/guitarra e baixo, a clave vem com o 8 embaixo (`clefOctave: -1`), e o som segue essa leitura: o aluno ouve exatamente o que a pauta indica.

### Edição

- **Cursor** sempre em um evento de uma pauta; no piano, troca de pauta com um botão/atalho.
- **Figura antes da nota**: escolher a figura e depois a nota. A nova nota **substitui** o que estiver no cursor; se for menor, o resto vira pausas; se for maior, consome os eventos seguintes; se passar do compasso, é dividida e ligada ao próximo.
- **Apagar** transforma em pausa (o compasso nunca fica incompleto).
- **Altura**: letras A–G (oitava mais próxima da nota anterior), ↑/↓ meio tom, Ctrl+↑/↓ oitava, Shift+letra acrescenta nota ao acorde. No celular: teclado de piano de uma oitava rolável e botões de oitava.
- **Bateria**: em vez de altura, botões das peças do kit (e teclas de atalho), várias peças no mesmo tempo formam um "acorde".
- **Ritmo**: números para figuras (1 semicolcheia, 2 colcheia, 3 semínima, 4 mínima, 5 semibreve), `.` ponto, `0` pausa, `T` ligadura, Ctrl+3 tercina. No celular, barra de botões com ícones das figuras.
- **Paleta pequena** (painel lateral no computador, folha inferior no celular): articulações, dinâmicas, cifra, dedilhado.
- **Compassos**: acrescentar/remover no fim ou após o selecionado.
- **Desfazer/refazer** (Ctrl+Z / Ctrl+Shift+Z e botões).
- **Ouvir enquanto escreve**: cada nota entrada toca brevemente com o som escolhido.
- Salvamento automático no aparelho.

### Editar a partitura gerada pela IA

- As partes **melodia**, **teclado** e **bateria** ganham **Editar** em dois lugares: na aba Partituras do Estúdio (dados da sessão, no componente `StudioScores`) e na partitura salva da biblioteca (`ScoreRecord` guardado, página da partitura). Em ambos, `songId` é o id da música de onde os dados vieram naquele momento.
- Antes de abrir, um diálogo pequeno pede o trecho: compasso inicial e final, sugerindo do primeiro compasso com nota até 32 compassos depois (o professor pode ampliar). Isso evita partituras de centenas de compassos pesadas no celular.
- Conversão: notas quantizadas na grade atual → eventos, sempre em **4/4** (a grade gerada é de 16 semicolcheias por compasso); tom e andamento da análise. Acentos onde a força da nota (velocity) estiver bem acima da média — só em melodia e teclado; a bateria gerada não traz força e só tem bumbo, caixa e chimbal. Violão e coral ficam como estão (não editáveis nesta versão).

### Modo de estudo (aluno e professor)

- Botão **Estudar** em qualquer partitura escrita.
- Tocar/pausar, cursor destacando a nota tocada, andamento 25%–150%, repetir trecho (selecionar compassos inicial e final), contagem inicial de um compasso, metrônomo liga/desliga, **mostrar nome das notas** (Dó, Ré, Mi…) acima de cada nota.
- Texto de instrução do professor no topo.

### Compartilhar

- **Compartilhar por link**: grava a partitura em `wmSheets/{id}` (1 documento) com `ownerUid`, `ownerName`, `title`, `sheet` (o modelo) e `updatedAt`. Qualquer usuário logado com o link abre (1 leitura) no modo de estudo e pode **Salvar uma cópia** na própria biblioteca.
- O salvamento automático é só local. O compartilhado muda apenas com o botão **Publicar alterações**; o editor mostra "alterações não publicadas" quando há diferença. Assim o aluno nunca vê a peça pela metade e as gravações no Firestore são poucas.
- O aluno guarda localmente as partituras abertas por link numa lista **Compartilhadas comigo** (tabela local própria, como `sharedSetlists`), que abre offline e se atualiza ao reabrir com conexão.
- O professor pode **parar de compartilhar** (apaga o documento).

### Exportar

- Baixar MusicXML (para abrir em outros programas) e imprimir/salvar PDF pela impressão do navegador.

## Regras do Firestore (trecho a entregar em `docs/`)

- `wmSheets/{id}`: leitura para usuário autenticado; criação/atualização/remoção só por `ownerUid == request.auth.uid`; tamanho do `sheet` limitado; campos fixos.

## Deixado para quem constrói

- Componentes e layout visual, seguindo o estilo do app.
- Mapeamento exato modelo → objetos do alphaTab e → MusicXML, e o mapa das peças do kit para notas de percussão General MIDI.
- Como mostrar o nome das notas (recurso da biblioteca, se existir, ou texto acima da nota).
- Algoritmos de dividir/juntar durações e de agrupar colcheias.
- Verificação: typecheck + build e validação no navegador pelo usuário (testes automatizados não são critério de pronto neste projeto).

## Decisões tomadas na revisão (chamadas do Claude, a conferir)

- Compartilhado só muda com **Publicar alterações**; salvamento automático é local.
- Violão/guitarra e baixo usam clave com 8 embaixo, e o som segue a leitura escrita.
- Partituras abertas por link ficam em **Compartilhadas comigo** no aparelho do aluno, disponíveis offline.
- **Editar** também na partitura gerada já salva na biblioteca, não só no Estúdio.
- Conversão da IA por trecho escolhido (padrão: do primeiro compasso com nota até 32 compassos), sempre em 4/4.
- Tercinas mistas (semínima + colcheia na mesma tercina) ficam fora desta versão.
- Tiques: semibreve = 96; pausa de compasso inteiro como evento próprio; dedilhado por nota.
- Cursor de edição é camada própria sobre a posição das notas desenhadas; "ouvir enquanto escreve" usa o sintetizador já carregado.
