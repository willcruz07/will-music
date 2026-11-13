# Estúdio no mobile: análise automática só de acordes

Pedido: desativar Whisper em celulares e iOS, orientar uso desktop para recursos de memória elevada e manter desktop atual.

Implementado: detecção compartilhada de iOS (incluindo iPadOS com user agent de Mac), Android e navegadores mobile. Pipeline mobile pula separação automática e transcrição, usa áudio original para LV-Chordia, e abre inicialmente na aba Acordes. Guardas de preload e transcrição impedem criação de worker Whisper via outras entradas. Modal inicial prepara apenas acordes no mobile. Separação manual exige confirmação com aviso de memória; partituras não começam automaticamente ao abrir a aba no mobile. Cada aba explica seu comportamento; edição manual e conteúdo salvo continuam acessíveis. Ajustes descreve a restrição e desabilita concorrência no mobile. Desktop mantém o fluxo existente.

A identificação por plataforma é conservadora, não uma medição de memória. Não promete ausência de falhas na análise de arquivos longos. Não apaga modelos ou dados existentes. Sem commits. Verificação de comportamento com iPhone, iPadOS e Android simulados; validação real Safari/PWA pelo usuário.

Revisão aprovada: separação manual também desativada no mobile. A função `separateSong` bloqueia a execução antes de consultar GPU, decodificar ou baixar modelos. O painel mostra orientação para desktop, e o hook não carrega os conjuntos de faixas salvos na memória no mobile. Ajustes prepara somente os modelos de acordes nesses dispositivos. Conteúdo salvo não é removido.
