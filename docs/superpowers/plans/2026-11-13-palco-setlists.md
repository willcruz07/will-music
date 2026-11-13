# Palco e repertórios de cifras

Evoluir a área Listas existente em Palco, sem perder as setlists ou quebrar links antigos. Página principal com repertórios, criação nomeada e acesso à organização/leitura. Editor seleciona cifras locais e reordena por drag handle com IDs estáveis, além de botões acessíveis. Leitura mantém a tela focada, tom, rolagem e próxima/anterior sem navegar para fora.

Rotas canônicas: /palco, /palco/repertorio/:id, leitura existente /palco/lista/:id. /listas e /listas/:id redirecionam. Adicionar ID opcional aos itens sem migração destrutiva. Editor dá retorno de falha de gravação e serializa atualizações. Cifras da seleção seguem a biblioteca de cifras sem áudio; repertórios existentes são preservados. Leitura não carrega MP3/modelos, ignora itens sem cifra e trata carregamento/erro. Pausar rolagem ao trocar de cifra ou ocultar a página; reduzir trocas acidentais por gestos diagonais.

Sem dependências novas, commits ou alterações remotas. Verificar fluxo de setlists/leitura, compatibilidade de dados e build; usuário valida arraste/toque no navegador.
