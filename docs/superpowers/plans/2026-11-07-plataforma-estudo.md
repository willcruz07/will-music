# Plataforma de estudo — plano

**Goal:** a seção Estudo vira uma plataforma organizada em trilhas e níveis (Iniciante, Intermediário, Avançado, Pro). As aulas trazem exemplos interativos e há ferramentas de prática.

**Pedido do usuário (2026-11-07):**
- harmonia aplicada completa, da tríade ao Pro:
  - intervalos, ciclo de quartas e de quintas;
  - progressões (2-5-1), trítono, empréstimo modal;
  - aproximações cromáticas, escala sobre centro tonal;
  - clusters, harmonia jazzística, progressões de bossa;
- escalas orientais e indianas, com digitação de escala em tablatura;
- licks de guitarra e dicas de improvisação;
- ritmo e bateria: paradiddle, gospel chops, gospel chords, estilo americano;
- canto:
  - afinação, diafragma e respiração, articulação, liberação da voz;
  - projeção, melismas, intervalos, aquecimento e ressonância;
  - extensão e tessitura, colocação, drivers;
- estilos: groove, rock, samba e pagode, MPB, R&B;
- cada tema em uma seção separada.

## Decisões (rulings)
- **Conteúdo:** é original, escrito para o app em pt-BR, a partir de conhecimento consolidado de teoria e pedagogia. Não há cópia de repositórios.
  - Os conjuntos abertos de referência (Open Music Theory, CC BY-SA; tonal.js, MIT) não cobrem tudo o que foi pedido, e copiar o texto obrigaria a CC BY-SA.
  - Os dados musicais (escalas, graus) são calculados pelas funções do próprio app, que têm testes.
- **Aulas como dados** (`src/study/content/*.ts`), com blocos tipados: texto, lista, dica, acordes, progressão, escala, intervalo, ritmo, tablatura e exercício. Um teste de integridade valida:
  - todos os acordes;
  - os graus romanos;
  - as escalas;
  - o tamanho dos padrões rítmicos;
  - as tablaturas;
  - ids únicos e níveis válidos.
- **Exemplos sonoros:** usam o sintetizador do app (som de piano, bateria sintetizada). Não há amostras gravadas.
- **Progresso de leitura** (aula concluída) fica no `localStorage`. É uma conveniência por aparelho.
- **Canto:** cada aula de técnica avisa que o app não substitui um professor ou fonoaudiólogo. Drivers e distorção trazem orientações de segurança.

## Estrutura
- `/estudo`: trilhas, ferramentas e "continuar de onde parou".
- `/estudo/trilha/:trilha`: as aulas da trilha, por nível.
- `/estudo/aula/:id`: a aula.
- `/estudo/ferramentas`: dicionário de acordes, formação, escalas e campo harmônico, intervalos, ciclo de quintas, progressões e escalas no braço.
- `/estudo?acorde=X` redireciona para as ferramentas.
