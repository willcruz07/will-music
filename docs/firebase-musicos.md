# Encontrar músicos

## Uso

- Acesso pela biblioteca, Minha conta ou Palco, em `/musicos`.
- Em `/conta`, ativar **Permitir que outros músicos encontrem meu perfil** e salvar. O padrão é false, inclusive para cadastros e rascunhos anteriores.
- São publicados apenas nome artístico (ou nome), foto, apresentação, localização informada, instrumentos, estilos, experiência, redes e disponibilidade. E-mail, preferências internas, credenciais, estatísticas e privilégios não fazem parte do documento público.
- Consultas exigem sessão e internet, com 20 registros por página. Nome busca pelo começo do nome de apresentação, ignorando caixa/acentos. Instrumento e estilo podem ser combinados. UF/cidade filtram o Brasil; sem filtro geográfico, aparecem também perfis de outros países.
- O perfil em `/musicos/{uid}` permite escolher uma setlist própria e enviar um convite. Músicos indisponíveis não recebem novos convites. Não há feed, mensagens privadas, busca de e-mail ou notificações push.

## Coleções e privacidade

`users/{uid}.musicianProfile.discoverable` mantém o consentimento privado. A mesma transação grava/remove `wmMusicians/{uid}`, uma projeção com whitelist explícita. A exclusão é física na projeção ao desativar; nenhuma cifra, conta ou setlist é excluída. Alterações no perfil privado e na projeção devem ser publicadas juntas. O login também reconcilia a projeção com os dados privados atuais.

Offline, a escolha fica pendente na fila de perfil existente. A retirada da busca só é efetiva depois da sincronização. Não persistimos perfis consultados de terceiros em um cache próprio; sem conexão, a interface deixa de mostrar a lista/detalhes. Como qualquer publicação na internet, retirar o perfil não apaga o que outra pessoa já tenha visto ou copiado.

O diretório não contém e-mails. Convites dessa tela usam o UID, no ID `wmInvites/{shareId}__uid_{recipientUid}`, com `recipientEmail: ''`, `recipientUid` e `recipientName` (nome público). O serviço não consulta `users` do destinatário. As regras conferem consentimento e disponibilidade no servidor antes de um convite novo/reaberto. A central consulta convites por UID **ou** pelo e-mail da conta; os convites anteriores continuam funcionando. Setlists previamente aceitas continuam legíveis quando o músico sai do diretório.

`searchName` normaliza o nome. `tags` contém instrumento, estilo e suas combinações, para usar uma única condição `array-contains` mesmo com ambos os filtros ativos. A consulta não baixa todos os músicos para filtrar no cliente. Links sociais são validados antes de renderizar e abrem com noopener/noreferrer.

## Firebase: antes de ativar

Nada foi publicado automaticamente.

1. Integrar as versões atualizadas de `firebase-perfil.rules` e `firebase-compartilhamento.rules` com as regras reais do projeto, dentro do bloco de documentos, em rules_version 2. O primeiro inclui `wmMusicians` e a consistência getAfter; o segundo cobre convites por UID e por e-mail. Não substituir regras de catálogo/administrador às cegas, nem manter uma regra recursiva permissiva que anule as restrições.
2. Incorporar `firebase-musicos.indexes.json` aos índices já existentes. Contém combinações de geografia/tags/nome e o novo índice de `wmInvites` por `recipientUid + updatedAt`. Preservar os índices de convite por e-mail e de setlists já definidos anteriormente.
3. A escrita de perfil/login passa a escrever/remover a projeção na mesma transação. Sem as novas permissões, a transação falha inteira; a sessão continua ativa e o rascunho permanece no aparelho, com nova tentativa disponível.
4. Testar regras no emulador e com duas contas em ambiente de teste antes de produção. Os testes locais dos serviços usam Firestore simulado; não comprovam a publicação/permissão no projeto remoto.

## Roteiro de validação real

- A, sem publicação: B não vê perfil; SDK direto não pode criar a projeção de A sem o consentimento na mesma transação.
- A publica: B encontra por nome, UF/cidade, instrumento e estilo combinados. Conferir paginação e nomes repetidos; confirmar ausência de e-mail/campos privados no documento.
- B não pode ler `users/A`, alterar `wmMusicians/A`, publicar campos extras ou falsificar contribuições.
- A desativa: projeção removida; recarregar perfil/lista em B. Diretório não deve continuar disponível offline.
- B convida A por UID: o convite aparece no sino de A, que aceita e lê offline no Palco. A versão publicada permanece imutável.
- C não pode ler o convite nem a versão de A. B não pode forjar aceite ou trocar o destinatário depois.
- A desativa convites: novas tentativas falham também por SDK direto. Atualizações de setlists já aceitas e convites legados continuam válidos.
- Retirar publicação com edição offline: informar pendência até reconectar; confirmar exclusão após sincronizar. Trocar a conta durante leitura/envio não pode mostrar ou gravar resultados da conta anterior.
