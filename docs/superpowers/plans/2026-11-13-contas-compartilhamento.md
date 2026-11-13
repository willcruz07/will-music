# Biblioteca por conta, convites e Palco compartilhado

Escopo aprovado: cifras e setlists por UID, cópia offline, notificações internas de convites com foto/nome do dono, aceitar/recusar, atualização explícita de versões e leitura pessoal no Palco. Sem mensagens externas ou push, sem áudio/modelos na nuvem. Compartilhamento privado por e-mail exato da conta Google; não disponibilizar diretório público de usuários.

1. Isolar banco local por UID. Primeiro usuário desta versão assume a biblioteca legada sem copiá-la/apagá-la. Outras contas recebem banco separado. Troca de UID força recarga antes de trocar o banco, evitando jobs antigos gravarem na conta nova.
2. Sincronizar cifras independentes e setlists pessoais em users/{uid}/wmCharts e wmSetlists. Recibos locais de revisão, exclusões com tombstones, fila/reconexão e conflitos preservados em cópia. Não ativar segundo cache persistente Firebase.
3. Publicações imutáveis em wmShares/{shareId}/versions/{version}/items; manifestos leves e convites privados em wmInvites. Aceitação registra versão e salva snapshot em tabela local dedicada. Ajustes pessoais de tom/rolagem não alteram o proprietário.
4. Sino/central de convites e modal de compartilhamento; seção Compartilhadas comigo no Palco; leitura offline do snapshot. Sincronização em segundo plano e indicação de estado em Minha conta.
5. Preparar fragmento de regras/índices e instruções de integração ao Firebase existente, sem publicar nem substituir regras de Alt7. Verificar com testes locais das decisões de merge/isolamento/snapshots, types e build. Não fazer commits.

Referências: https://firebase.google.com/docs/firestore/manage-data/transactions ; https://firebase.google.com/docs/firestore/security/rules-fields ; https://firebase.google.com/docs/firestore/security/rules-conditions . A funcionalidade depende da configuração real de regras e índices, validada pelo usuário com duas contas.
