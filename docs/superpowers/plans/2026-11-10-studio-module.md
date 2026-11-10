# Estúdio Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar o Estúdio aprovado para músicas com áudio, preservando o leitor de cifras atual.
**Architecture:** Song mantém o carregamento e pipeline existentes; uma apresentação Studio reutiliza Player em modo inline, Waveform, ChartView, StemsPanel e BottomSheet. Biblioteca distingue itens pela presença de áudio. Salvar cifra cria um item independente sem duplicar áudio.
**Tech Stack:** React, TypeScript, Dexie, Tailwind, Web Audio e workers atuais.
**Spec:** Desenho aprovado na conversa e mockup estudio-mockup.html; Letras, Acordes, Tracks; BPM/tom interativos, loop na onda, edição ChordPro em bottom sheet, exportação da mix existente.

## Global Constraints
- Sem commit, push, publicação ou intervenção no merge em andamento.
- Manter inferência LV-Chordia/Whisper e separação existentes; sem novas bibliotecas.
- Preservar dados existentes; não executar migração destrutiva nem apagar análises salvas.
- Sem inventar compassos ou BPM: mostrar sequência temporal e BPM somente quando disponível.
- Usuário valida no navegador; verificações locais de tipos/build e testes direcionados quando necessários.

## Review Focus
- Troca de aba não remonta o player nem encerra processamento.
- Análise parcial/erro não bloqueia leitura de resultados concluídos.
- Cifra exportada à biblioteca é independente e não duplica MP3.
- Bottom sheet mantém rascunho em falha de salvamento e é acessível por teclado.
- Rotas antigas e cifras sem áudio mantêm comportamento.

## Tasks
- [x] 1. Player inline: reaproveitar transporte, velocidades, Waveform e loop; preservar modo flutuante existente.
- [x] 2. Studio: três abas, skeletons por tarefa, sequência temporal e dock de formações, editor bottom sheet, Tracks com exportação atual.
- [x] 3. Integração Song/Layout/biblioteca: áudio abre Studio, ocultar navegação geral nesse contexto, biblioteca Estúdio/Cifras, salvar cifra independente atomicamente.
- [x] 4. Verificação de tipos/build, checks direcionados, revisão independente e correções relevantes; sem commits.

## Ledger
- Ruling: execução contínua autorizada pelo usuário; plano documenta desenho já aprovado sem nova rodada de aprovação.
- Ruling: merge em andamento impede criar branch; preservar índice e merge e editar somente arquivos autorizados no workspace.
- Resultados novos do Estúdio usam runPipeline({persist:false}), com retenção compartilhada entre página e job. Cópias antigas no banco permanecem intactas. Sair da página após o job descarta a análise temporária; reabrir inicia nova análise. Salvar cifra independente persiste somente o texto e apresentação.
- Validação: 29 testes direcionados passaram; TypeScript e build de produção passaram. Revisão independente identificou navegação com áudio antigo e posição das waves baseada no acorde; ambos corrigidos e revisão do ciclo de sessão sem novos bloqueios.
- Limites preservados: transposição afeta cifra/diagramas, não faz pitch-shift do áudio; exportação de mix usa volumes/mute/solo existentes. Compassos e metrônomo não são simulados. Safari/iPhone físico e aparência final ficam para validação manual do usuário. Aviso de chunk grande da partitura já existente permanece.

## Organização das ações e diagramas da cifra
- Header do Estúdio: apenas Dados da música. Modal simplificado para nome, artista, capo, BPM e reanálise, sem pasta/compasso/atalhos de exportação/exclusão.
- Letras: editar, salvar e imprimir na própria aba; galeria de acordes únicos com instrumento e variação por acorde. Cifra salva preserva todas as escolhas, inclusive os padrões não alterados.
- As escolhas são associadas ao acorde original, antes da transposição, evitando perda ou troca de instrumentos ao alterar o tom. Regressão coberta por teste.
- Leitor da biblioteca mostra a mesma galeria e permite imprimir letra/cifra e diagramas escolhidos, sem os controles.
- Tracks: exportação MP3 primária no topo do mixer, sem seletor de tipo ou apagar separação no contexto do Estúdio.
- Verificação desta extensão: TypeScript e 11 testes direcionados passaram; revisão independente gerou a correção de identidade dos acordes. Impressão real e usabilidade mobile continuam para teste manual do usuário.

## Leitor de cifras independentes
- Controles agrupados em duas linhas: transposição/tamanho e editar/listas/imprimir, sem Palco/Partitura/Dados/excluir.
- Editor ChordPro preenche o texto existente, preserva transposição e remapeia tempos das linhas; ao salvar, cifra e diagramas atualizam juntos.
- Listas em bottom sheet com seleção existente ou criação e vínculo em uma escrita atômica. Erros mantêm o formulário aberto.
- ChartOptions é identificado pelo id da cifra para não transportar rascunhos entre registros. O leitor volta para /?aba=cifras.
- TypeScript e 13 testes direcionados passaram, incluindo transposição real dos diagramas, tamanho, edição e criação/vínculo de listas. Sem commits ou publicação.

## Biblioteca em cards
- Abas diferenciadas por ícone, descrição e contagem. Grid de duas colunas no mobile, três no tablet e quatro em telas largas.
- Cards Estúdio: título/artista, duração, descrição de uso, BPM conhecido. Cards Cifras: trecho, tom com transposição aplicada, instrumento/capo quando informados. Cards Partituras: partes disponíveis, BPM e status.
- Exclusão separada do link de abertura, com confirmação e tratamento de erro. Contagens e filtros são atualizados após exclusão/importação.
- Partituras retêm apenas resumos de seus registros na listagem; sem carregar áudio ou processar modelos para montar cards.
- Revisão corrigiu atualização da lista de partituras após importação sem sair da aba. TypeScript, build e checks direcionados passaram; última suíte de cards/exclusão/partituras: 24 testes.
