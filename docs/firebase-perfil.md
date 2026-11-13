# Perfil musical na conta

`/conta` agora permite editar nome, apelido/nome artístico, apresentação, cidade/região/país, instrumentos e voz, estilos, experiência, redes sociais e disponibilidade para novos convites de setlists. Foto e e-mail continuam vinculados à identidade já existente; editar o nome do aplicativo não altera as credenciais Google.

## Persistência

Nome em `users/{uid}.name`; os campos musicais ficam no mapa `musicianProfile`. O serviço usa transação com atualização apenas de campos permitidos, preservando foto, preferências antigas, notificações, datas de criação e privilégios do Alt7. Login não substitui a apresentação nem as escolhas musicais por dados Google.

O cache/fila usa `settings['wm-musician-profile']` no banco local da conta. O botão salva primeiro no aparelho e tenta enviar ao servidor. Offline ou em falha de rede/permissão, o rascunho continua disponível. Ao reconectar/iniciar, a fila tenta enviar novamente. Uma confirmação antiga não apaga uma revisão local mais recente. Se dois aparelhos editarem o perfil offline, prevalece a última gravação no servidor; não há mesclagem campo a campo do perfil.

## Convites

`wmInvitePreferences/{emailNormalizado}` contém somente `acceptsInvites`, sem UID, localização, redes sociais ou nome. O próprio usuário grava esse documento atomicamente com o perfil; uma conta autenticada e verificada pode consultar um endereço exato para validar o envio. Listar a coleção não é permitido. Desativar bloqueia convites novos e o reenvio de convites recusados, após sincronizar. Convites existentes podem ser respondidos e versões de setlists já aceitas continuam funcionando. Endereços sem documento de preferência ainda podem receber convites; ao criar/sincronizar um perfil, o padrão passa a ser desativado até o usuário escolher ativar.

## Contadores

“Cifras salvas” e “Suas setlists” contam os registros locais da biblioteca. Não são contribuições públicas. “Contribuições” lê exclusivamente `users/{uid}.willMusicStats.contributions`, inteiro não negativo atualizado por um fluxo confiável de servidor. O editor e o login não gravam esse contador. Sem um processo de contribuição/contagem no servidor, a interface exibe “—” e informa que ainda não há registro; não inventa uma contagem com base em músicas salvas.

## Firebase: configuração antes do teste entre contas

1. Integrar `firebase-perfil.rules` com as regras atuais e com `firebase-compartilhamento.rules`, dentro do bloco de documentos, usando rules_version 2. Este é um fragmento de referência, não um substituto integral das regras do projeto Alt7. Revisar as permissões já existentes de `users`: blocos sobrepostos permissivos se somam e podem permitir alterações em privilégios/estatísticas. Preservar os acessos administrativos legítimos do outro aplicativo na integração.
2. A transação de login agora também escreve a preferência mínima. Sem autorização em `wmInvitePreferences`, essa transação falha inteira e a sessão permanece ativa, com possibilidade de tentar novamente. Não é necessário limpar dados.
3. O fragmento de compartilhamento passou a consultar a preferência para criar/reabrir convites. Aplicar ambos para que a restrição exista também no servidor, além da interface.
4. Não são necessários índices compostos novos para o perfil. Nenhuma regra foi publicada automaticamente.
5. Validar as regras no emulador/ambiente de teste antes de produção: A só edita seu UID; B não lê o perfil de A nem altera sua preferência; nenhum cliente pode modificar `willMusicStats`, `owner` ou `isUserPremium`; remetente não consegue criar convite para uma preferência desativada por acesso direto ao Firestore. Testes de código com serviços simulados não substituem essa verificação.

## Validação manual

Editar todos os grupos, salvar e recarregar; confirmar nome/avatar no header e nome nos próximos convites. Testar mobile com textos e links longos. Desconectar, editar e salvar, recarregar e reconectar; conferir o rascunho e a confirmação. Verificar a alternância entre contas e preservação de privilégios do documento. Desativar novos convites em B e tentar enviar de A; convites existentes devem continuar acessíveis.

## Seleção de estado e cidade

Para o Brasil, o perfil usa o `SheetSelect` padrão com busca, 27 UFs e municípios vinculados à UF. A cidade fica desabilitada até selecionar um estado; trocar o estado limpa a cidade. A validação da aplicação rejeita combinações brasileiras inválidas e normaliza nomes antigos de estado para a sigla. Outros países mantêm o preenchimento manual.

Snapshot local obtido em 13/11/2026 do [serviço de localidades do IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado), com 5.571 municípios. `brazilLocationsData.ts` contém apenas nomes de UF, siglas e nomes de municípios. Não há chamadas ao IBGE em runtime, nem envio da localização para esse serviço. O módulo JavaScript entra no precache do PWA; atualizações da lista exigem regenerar o snapshot a partir da fonte e publicar o app. O formato de `musicianProfile.location` é mantido, sem nova migração ou regra adicional no Firebase.
