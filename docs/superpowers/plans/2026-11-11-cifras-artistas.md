# Leitura e artistas — execução autorizada

1. Parser comum de raiz/baixo: acidentes Unicode, extensões com barra numérica, agrupamento de cifras. Manter sufixos e corrigir também a consulta de notas dos diagramas.
2. Leitor compartilhado: quebrar palavras em vez de frases inteiras; manter sílabas da mesma palavra juntas e offsets de edição intactos. Cifras menores e sem quebra; catálogo inicia em 16 px.
3. Preservar artist.name/photo/slug. Paginar artistas a partir de cifras, avançando pelo nome para evitar repetição, sem varrer toda a collection.
4. Página protegida do artista, com foto, nome e busca por título restrita ao slug (ou nome quando não houver slug). Reaproveitar leitor, cards e cópias locais.
5. Incluir definição dos índices necessários, sem publicar alterações no Firebase. Verificar transposição, offsets, paginação e isolamento do filtro. Sem commit; validação visual pelo usuário.
