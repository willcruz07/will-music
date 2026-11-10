# LV-Chordia experimental no navegador

Objetivo aprovado: testar reconhecimento ampliado e diagramas somente na tela de música,
preservando ChordMini, dados existentes, cifras editadas e a arquitetura atual. Sem commits/push.

Implementação experimental: CQT híbrido em TypeScript, redes ONNX com normalização numericamente
estável em worker WASM e decodificador Viterbi portado do upstream MIT. Filtros estáticos gerados
offline para 100 valores de afinação; somente o filtro escolhido é baixado. Reamostragem polifásica,
explicitamente diferente de SoXR no protótipo original. Modelos/filtros conferidos por SHA-256.

- [x] Converter as redes e investigar divergência WASM sem relaxar a tolerância.
- [x] Portar estimativa de afinação, extração CQT e decodificação para TypeScript.
- [x] Comparar CQT com referência Python polifásica: trecho real e três afinações sintéticas.
- [x] Comparar ensemble/decoder com referência no trecho real.
- [x] Trocar endpoints de processamento por arquivos estáticos; não há POST nem Python no runtime.
- [x] Mostrar comparação por trecho de 15/30/60 s na rota existente `/musica/:id`.
- [x] Diagramas com seleção de instrumento/posição e validação estrita de notas e baixo no laboratório.
- [x] Aplicação explícita ao intervalo, preservando cifras editadas e acordes fora do trecho.
- [x] Verificação visual: analisar, selecionar A/E, alternar três instrumentos e aplicar à fixture local.

Resultados: 30 s analisados em aproximadamente 4,7 s no navegador do ambiente de validação.
Resultados temporais e musicais não extrapolados para iPhone ou música inteira.
Ainda experimental, opt-in em `npm run dev:chords`, excluído do build de produção.

Verificações: 149 testes do engine e 56 testes direcionados da aplicação passaram; typecheck e build passaram.
A suíte completa encontrou 10 falhas nos testes modelsSetup/stems/quota que ainda esperam opções ou
mensagens anteriores à migração para seis faixas. Os arquivos de produção e os testes correspondentes
permanecem idênticos ao HEAD inicial deste experimento. Não foram corrigidos fora do escopo.

Próximas etapas fora deste recorte: medir faixas completas e mobile, ampliar referências humanas,
distribuir ativos estáticos com versionamento e decidir promoção a opção de produção.
