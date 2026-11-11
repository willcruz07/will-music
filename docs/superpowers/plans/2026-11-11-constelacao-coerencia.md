# Constelação: coerência musical e histórico

Escopo aprovado: preservar a navegação visual, corrigir histórico, prévia, explicações,
referência tonal, ampliar conexões e melhorar a condução sonora sem novos modelos.

1. `web.ts`: guardar ocorrências imutáveis, origem e retorno por índice; prévia usa a ligação.
2. `harmony.ts`: referência estável, relações identificadas, notas comuns calculadas,
   suspensões e destinos coerentes; diminutos, aumentados e extensões compatíveis.
3. `voicing.ts`: voicings locais econômicos com baixo separado e todas as notas preservadas.
4. Página: diário derivado das ocorrências; ouvir transição/caminho; adoção explícita de centro;
   explicar notas comuns e limitar a densidade da prévia.
5. Verificar TypeScript, diff e consultas determinísticas aos casos diagnosticados.

Conforme preferência do usuário, não executar benchmarks de áudio, testes de interface,
commits ou publicação. A escuta e validação visual ficam para o navegador do usuário.
Os testes anteriores que impõem mudança automática de centro e proíbem substituição
entre dominantes precisam ter suas expectativas alinhadas à proposta aprovada.

## Resultado

- Histórico e reinício usam ocorrências/origem preservadas; retorno do diário identifica a visita.
- Prévia limitada a quatro caminhos por vizinho, sempre partindo do acorde da ligação.
- Referência estável e adoção explícita de outro centro; destino local mostrado separadamente.
- Relações e notas comuns calculadas; transformações de tríades e extensões ampliadas.
- Suspensões e substituições respeitam o destino escolhido; variações não herdam função incompatível.
- Som local com busca limitada de voicings próximos; escuta acionada explicitamente.
- 47 verificações unitárias de harmonia/estado/condução aprovadas; build PWA aprovado.
- Validação sonora e visual no Safari/Chrome permanece com o usuário; nenhum commit.
