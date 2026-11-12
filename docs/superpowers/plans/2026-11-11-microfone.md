# Microfone: estabilidade e prática local

Implementação autorizada, sem integração com trilhas e sem commits.

- Afinador: apagar sinal antigo após 600 ms sem altura confiável; seleção automática/manual de corda, preservando diferença real em cents.
- Voz: nota-alvo, referência sonora e exercício curto de segunda maior; mostrar desvio e extensão observada, com classificação secundária e explicitamente limitada à amostra.
- Mobile: limitar detecção a 20 Hz independentemente da taxa da tela; fechar captura ao ocultar página, interromper contexto ou perder track; invalidar abertura pendente e limpar leituras.
- Acordes: manter o modelo ao vivo atual nesta etapa. O analisador LV disponível recria cinco sessões por bloco e não deve ser disparado continuamente sem arquitetura própria. Melhorar silêncio, estados, erros e cancelamento do worker atual; deixar claro que uma nota cantada não determina um acorde completo.
- Verificar lógica, ciclo de vida, tipos e build; usuário faz validação sonora/visual em aparelhos reais.
