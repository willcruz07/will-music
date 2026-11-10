# Partituras no Estúdio — Implementation Plan

**Goal:** Reaproveitar faixas temporárias para gerar partituras sob demanda; persistir somente partituras explicitamente salvas.
**Architecture:** Adaptador studioScore sem leituras de áudio/score no banco; reutiliza Basic Pitch, detector de bateria e MusicXML existentes. Componentes do Estúdio mantêm cache em memória por instrumento. Salvamento cria um item independente com todas as partes prontas (MusicXML, notas e grade por tipo), sem áudio ou dependência da origem. Biblioteca passa a ter três abas; navegação oferece Microfone. Exportar MusicXML continua restrito à parte aberta.
**Spec:** Fluxo aprovado na conversa em 2026-11-10.

## Restrições
- Sem commits, publicação ou alterações no merge em andamento.
- Sem novo modelo ou biblioteca; não repetir separação/acordes/letra.
- Gerar um instrumento por vez; cancelar worker ao sair do Estúdio, preservar resultados ao trocar abas.
- Coral SATB estimado; guitarra representa linha de notas da faixa de guitarra, sem prometer transcrição polifônica perfeita.
- Rotas antigas e partituras salvas anteriormente continuam funcionando.

## Tarefas
- [x] Adaptador para gerar a partir de tracks fornecidas, com cancelamento e reaproveitamento de notas vocais.
- [x] Aba Partituras com opções, progresso, cache de sessão, visualização MusicXML, salvar/exportar.
- [x] Snapshot independente de partitura e leitura sem áudio; biblioteca Estúdio/Cifras/Partituras e Microfone no menu.
- [x] Tipos/build, checks relevantes e revisão de integração.

## Resultado e verificação
- 31 testes direcionados passaram, incluindo reaproveitamento vocal, fonte de guitarra, snapshot sem áudio que sobrevive à exclusão da origem, navegação e regressões de partituras existentes.
- TypeScript, build de produção e diff --check passaram. Permanece o aviso preexistente de chunk grande do OSMD.
- Revisão independente apontou cache antigo após troca de tracks; correção associa cache à identidade das faixas e protege conclusão de salvamentos por geração da sessão. Regressão coberta por teste de troca de faixas.
- /partituras redireciona para /?aba=partituras; leitores /musica/:id/partitura continuam compatíveis.
- Limites: escrita atual assume 4/4; coral é distribuição SATB estimada; guitarra é uma linha extraída da faixa, não transcrição polifônica integral. Essas condições são informadas no produto.
- Não foram realizados testes visuais no navegador, commits ou publicação.
- Ajuste de usabilidade: botão “Salvar partituras (N)” ao lado dos seletores salva todas as partes com check em um único registro. Grade temporal preservada por instrumento, com fallback para snapshots antigos. Typecheck e 21 testes direcionados passaram após o ajuste.
