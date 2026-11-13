# Catálogo compacto e filtros

Requisitos: remover banner e salvamento da listagem; linhas compactas com avatar, título/artista/tom/estilo; artistas alfabéticos com quantidade de cifras; mais artistas na primeira página; pesquisa e filtros sticky; bottom sheet de filtros com resumo e limpeza.

Consultas: preservar paginação no servidor, incluir estilo por igualdade, letra por prefixo e direção de ordenação. Descobrir estilos reais de forma paginada, sem catálogo fixo inventado. Buscar páginas adicionais de artistas até 24 distintos, no máximo 24 consultas limitadas por página; não varrer o acervo inteiro. Contagens via agregação count(), em lotes de 3 e cache, exibidas sem bloquear os resultados. Não estimar contagens pelo tamanho da página. Filtros persistidos na URL e mantidos na navegação de retorno.

UI: lista em uma coluna no celular e duas no desktop; avatar circular à esquerda, metadados compactos e chevron. Input e botão de filtros fixos abaixo do header global. Sem novas dependências. Atualizar definições de índices apenas locais; não publicar regras ou índices. Testes focados de consultas/fluxos, types e build; navegador pelo usuário. Sem commits.
