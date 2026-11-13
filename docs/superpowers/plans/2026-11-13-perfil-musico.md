# Perfil musical na conta

Escopo autorizado: ampliar `/conta` e salvar os dados em `users/{uid}`, mantendo login Google, arquitetura e design existentes. Sem commits/deploy.

1. Criar esquema e validação de nome, apelido, apresentação, localização aproximada (cidade/estado/país), instrumentos/voz, estilos, experiência e links. Não solicitar endereço ou localização GPS. Dados musicais ficam em `musicianProfile`, preservando campos e privilégios do Alt7.
2. Serviço privado de leitura/gravação por UID, com mesclagem em transação. Contagem de contribuições é somente leitura, em `willMusicStats.contributions`; sem origem de contribuições confirmadas, exibir ausência de registro. Quantidades de cifras e setlists refletem a biblioteca local e não são contribuições públicas.
3. Cache e fila de edição offline em settings do banco da conta. Identificar cada revisão local, sincronizar ao reconectar e não apagar edições mais novas após uma resposta antiga. Atualizar o nome exibido na sessão sem mudar credenciais Google.
4. Formulário responsivo em seções com chips de seleção, campos acessíveis, status de salvamento e erro recuperável. Integrar em `/conta`, sem alongar a tela de login.
5. Preferência de novos convites em documento mínimo `wmInvitePreferences/{email}` contendo apenas `acceptsInvites`; impedir novos convites quando desativada sem permitir leitura pública de `users`. Convites existentes permanecem respondíveis e setlists aceitas continuam acessíveis. Novos perfis iniciam sem receber novos convites; convites para endereços ainda sem preferência preservam o fluxo existente.
6. Documentar regras e extensão de perfil sem publicar no Firebase. Verificar validações, preservação de campos, persistência offline, nome personalizado e preferência de convites com testes direcionados; executar tipos/build. Teste visual final fica com o usuário.

Decisão: formulário privado no documento existente, em vez de uma coleção pública ou módulo social. A base pode servir futuramente a perfis públicos, mas este passo não publica dados pessoais nem implementa feed.
