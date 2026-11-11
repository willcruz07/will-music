# Evolução das trilhas — implementação autorizada

Base: avaliação aprovada em `docs/avaliacao-trilhas-estudo-2026-11-11.md`.

1. Corrigir conceitos nos conteúdos existentes, preservando IDs e progresso.
2. Ampliar `study/types.ts` com metadados pedagógicos, notação e pergunta de revisão; implementar renderização em `blocks.tsx` e `StudyHome.tsx`.
3. Criar `study/notation.ts`: exemplos tipados com alturas escritas, pausas, durações, claves, vozes, alterações e quiálteras. Gerar MusicXML e áudio dos mesmos dados. Usar ScoreView sob demanda, sem transcrição nem IndexedDB.
4. Criar conteúdo próprio de partituras e cavaquinho, nos quatro níveis. Parametrizar afinação de tablaturas e escalas; reutilizar diagramas.
5. Acrescentar aulas práticas a todas as trilhas atuais, com objetivos, exercícios e autoavaliação. Conectar pré-requisitos reais às aulas relacionadas.
6. Fazer a dinâmica de ritmo chegar ao synth com campo opcional compatível com os eventos atuais; demonstrar acentos e ghost notes.
7. Verificar catálogo, integridade de links/IDs, som/escrita, duração de compassos e tipos/build. Sem teste de navegador, benchmark, commit ou publicação; usuário valida a interface.

Escopo editorial: evolução incremental autoral. Não copiar páginas do livro, não prometer diagnóstico vocal, timbre realista ou interpretação automática de tablaturas. Manter livre acesso às aulas e marcação manual como “estudada”.

## Resultado

- Catálogo ampliado de 9 trilhas/81 aulas para 11 trilhas/127 aulas: 17 de partituras, 10 de cavaquinho e 19 de aprofundamento nas trilhas anteriores.
- Novas aulas com objetivos, pré-requisitos, prática e critérios de autoavaliação; perguntas com explicações quando aplicáveis. Links de prática nas aulas antigas e novas.
- IDs anteriores mantidos. Correções editoriais em harmonia, técnica instrumental, ritmo, improviso e canto.
- Notação com altura escrita, oitava, alterações, pausas, ponto, prolongamento, tercinas, partes simultâneas, acento e staccato. Gerador comum de MusicXML e eventos sonoros. Visualizador carregado após ação do usuário; andamento ajustável.
- Cavaquinho com afinação D4–G4–B4–D5, quatro cordas no braço/tablatura e instrumento inicial contextual nos diagramas.
- Dinâmica opcional no sintetizador compartilhado, sem alterar o contrato dos eventos existentes. Pausas finais contam na duração dos novos exemplos.
- Validação: 52 testes passaram em seis arquivos; TypeScript sem erros; build PWA concluído. Três consultas antigas de testes de ferramentas foram atualizadas para a interface já existente (botões de escala/tom e Arena de Ouvido).
- Build mantém aviso de chunks acima de 500 kB; nenhuma dependência adicionada. Sem teste visual/auditivo no navegador, commit ou publicação. Avaliação prática fica a cargo do usuário.
