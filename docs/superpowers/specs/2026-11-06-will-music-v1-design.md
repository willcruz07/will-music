# will-music V1 — design

Data: 06/11/2026 · Contexto completo da concepção: [`docs/contexto-do-projeto.md`](../../contexto-do-projeto.md)

## 1. Intenção

O autor é músico (toca em igreja, ensaios e shows). As ferramentas que ajudam a tirar e tocar músicas são pagas e espalhadas: Cifra Club, Moises, MuseScore. O will-music é um app gratuito e open source que junta isso num lugar só, começando por um uso individual e evoluindo, em versões futuras, para um app de grupo em que todos os músicos compartilham o mesmo repertório.

A V1 resolve o caso central: **enviar um MP3 e sair com a cifra (letra + acordes + tom), as faixas separadas para estudar e a música pronta para tocar no culto ou no show**, tudo no próprio aparelho.

### Dois momentos de uso

| Momento | Onde | O que acontece |
|---|---|---|
| **Estudo** | Casa, computador ou tablet | Enviar MP3, analisar, separar faixas, corrigir a cifra, praticar com o player |
| **Palco** | Culto, louvor, show, ensaio; celular ou tablet | Só ler o que foi preparado: abrir rápido, offline, letra grande, tela acesa, rolagem automática, passar de uma música para a próxima da lista |

O processamento pesado acontece no momento de estudo. O modo palco nunca roda modelos.

## 2. Objetivos, não objetivos e antiobjetivos

### Objetivos da V1
1. Do MP3 à cifra editável, com tom e acordes no tempo, sem servidor de processamento.
2. Separar voz/instrumental (padrão) e 6 faixas (opcional), com mixer.
3. Player de estudo: velocidade sem mudar o tom, destaque do acorde e da linha atuais, rolagem automática, loop A-B.
4. Biblioteca local, setlists e modo palco utilizáveis offline no celular.
5. Dados do usuário em formatos abertos, exportáveis.

### Não objetivos da V1 (vêm depois)
- Partitura e tablatura da melodia, edição de partitura, "abrir no MuseScore" → V1.1.
- Vozes por naipe (soprano, contralto, tenor, baixo) → V2.
- Login, sincronização, grupos, setlists compartilhadas, comunidade, perfil, ranking → V3 (Supabase ou Firebase).
- Link do YouTube, captura de áudio de aba, transcrição de letra com Whisper → sem data.
- App desktop (Tauri) → só se fizer falta.

### Antiobjetivos (seria um fracasso mesmo funcionando)
- Depender de servidor para processar áudio, ou ter custo recorrente para o usuário.
- Baixar, hospedar ou distribuir músicas de terceiros a partir de um servidor do projeto.
- Prender os dados do usuário num formato fechado.
- Modo palco que falha sem internet, apaga a tela ou demora para abrir no meio do culto.
- Usar modelos ou bibliotecas com licença não comercial ou incompatível (ver §9).

## 3. Restrições

- **PWA**, instalável em computador e celular, offline depois do primeiro uso. Decisão do usuário, confirmada na conversa.
- **Processamento 100% no navegador**: `onnxruntime-web` com WebGPU; fallback em WASM (CPU) quando não houver WebGPU.
- **Stack**: React + Vite + TypeScript + Tailwind + shadcn/ui. Decisão do usuário (ele domina React; aceitou trocar Next.js por Vite).
- **Modelos do Hugging Face**, baixados sob demanda, nunca empacotados no app (§6).
- **Hospedagem estática** (GitHub Pages, Netlify ou Vercel); sem backend na V1.
- **Navegadores**:
  - Suporte completo (análise e separação): Chrome e Edge, desktop e Android.
  - Safari iOS e Firefox: biblioteca, cifra, editor, player, setlists e modo palco devem funcionar; análise e separação em "melhor esforço", com aviso claro quando o aparelho não suportar.
- **Idioma da interface**: português do Brasil.

## 4. Arquitetura

```
┌──────────────── Thread principal (React) ────────────────┐
│ Telas · player (Web Audio) · editor · setlists · palco   │
└───────▲──────────────────────────┬───────────────────────┘
        │ progresso / resultados   │ jobs
┌───────┴──────────────────────────▼───────────────────────┐
│ Web Workers                                              │
│  • decodificação e reamostragem do áudio                 │
│  • análise: S-KEY · ChordMini (+CQT) · Beat This         │
│  • separação: Mel-Band RoFormer · htdemucs_6s            │
│  • gerenciador de modelos (download, hash, cache)        │
└───────▲──────────────────────────────────────────────────┘
        │
┌───────┴──────── Armazenamento local ─────────────────────┐
│ IndexedDB: músicas, cifras, análises, setlists, config   │
│ OPFS: áudio original, faixas separadas                   │
│ Cache Storage: app (service worker) e modelos            │
└──────────────────────────────────────────────────────────┘
        Internet (opcional): LRCLIB (letra) · Hugging Face e espelho (modelos)
```

- A interface nunca roda inferência na thread principal.
- Um job de análise é retomável ou cancelável; se a aba fechar no meio, a música fica com estado "análise incompleta" e o usuário pode reprocessar.
- **Referência de implementação**: o Musetric (`github.com/musetric/musetric`, código MIT) já implementa no navegador o CQT exigido pelo ChordMini (`packages/cqt`), FFT/STFT, a separação em janelas e a orquestração em `packages/ai`. Reaproveitar ou portar esse código é permitido e recomendado, com atribuição no `thirdPartyNotices`. O nome e o logo "Musetric" não podem ser usados.

## 5. Dados e formatos

### 5.1 Entidades (IndexedDB)

Todo registro tem `id` (UUID v4), `createdAt`, `updatedAt` (ISO 8601) e `deletedAt` opcional (exclusão lógica), para permitir sincronização na V3.

- **Song**: título, artista, tom original, andamento (BPM), compasso, capotraste, tags, favorito, duração, referência ao áudio original no OPFS, estado da análise, estado da separação.
  Campos herdados do cifras.app: `title, artist, key, tempo, timeSignature, capo, tags, duration`.
- **Chart (cifra)**: `songId`, texto ChordPro, transposição salva, tamanho de fonte preferido, **mapa de sincronização** (§5.5), `origin` (`generated` | `edited` | `manual`) e `generatedFromAnalysisId`.
- **Analysis**: `songId`, JSON da análise (§5.3), versão dos modelos usados.
- **Stems**: `songId`, modo (`2` ou `6`), lista de faixas com referência ao arquivo no OPFS.
- **Setlist**: nome, data opcional, lista ordenada de itens `{songId, targetKey?, observação}`. *(Decisão do Claude.)* `targetKey` é o **tom absoluto** em que a música será tocada naquela lista (ex.: "D"), porque músicos pensam em "tocar em Ré", não em "+2". Sem `targetKey`, vale o tom salvo na cifra. Mudar o tom no modo palco grava só no item da setlist, nunca na música.
- **Settings**: tema, tamanho de fonte padrão, modelos baixados, modo de separação padrão.

Uma música pode existir sem áudio: o usuário cria ou cola uma cifra manualmente.

### 5.2 Cifra: ChordPro

O texto da cifra segue [ChordPro](https://www.chordpro.org/):
- Metadados: `{title:}`, `{artist:}`, `{key:}`, `{tempo:}`, `{time:}`, `{capo:}`.
- Acordes inline: `[C]Hoje eu a[G]cordei`.
- Seções: `{start_of_verse}`, `{start_of_chorus}`, `{comment: Intro}` etc.
- O tempo de cada linha **não** vai no ChordPro (ele fica limpo e editável em qualquer app); fica na análise (`lines[].start`).

O formato `[C]` do cifras.app já é compatível com acordes inline.

### 5.3 Análise: JSON

```json
{
  "schemaVersion": 1,
  "models": { "chords": "chordmini-onnx@<sha>", "key": "skey-onnx@<sha>", "beats": "beat-this-onnx@<sha>" },
  "duration": 212.4,
  "key": { "label": "G major", "source": "instrumental" },
  "beats": [0.52, 1.18, 1.84],
  "downbeats": [0.52, 3.16],
  "chords": [ { "start": 0.0, "end": 2.6, "label": "G", "raw": "G" } ],
  "lyrics": { "source": "lrclib", "lrclibId": 123, "lines": [ { "start": 19.32, "text": "..." } ] }
}
```
Os nomes exatos dos campos ficam a cargo do construtor; o que importa é: tempos em segundos, rótulo bruto do modelo preservado (`raw`) e rótulo de exibição normalizado (`label`, ex.: `C:min7` → `Cm7`).

### 5.4 Pacote de exportação (`.zip`)

```
<titulo>.willmusic.zip
├─ manifest.json        (versão do formato, id da música, metadados)
├─ chart.cho            (ChordPro)
├─ analysis.json
├─ audio/original.<ext> (opcional)
└─ stems/<nome>.<ext>   (opcional)
```
Importar um pacote cria a música; se o `id` já existir, perguntar se substitui ou duplica. Exportar e importar uma setlist inteira (várias músicas num zip) também é suportado, pois é assim que o repertório preparado no computador chega ao celular na V1.

Pedir `navigator.storage.persist()` na primeira vez que houver dados, e mostrar o espaço usado nas configurações.

Importar um pacote com `id` existente e escolher "substituir" troca tudo da música (cifra, análise, áudio e faixas), depois de uma confirmação que diz isso explicitamente. *(Decisão do Claude.)*

### 5.5 Sincronização entre cifra e tempo *(decisão do Claude)*

O tempo pertence à **cifra editada**, não à análise, para o player continuar sincronizado depois que o usuário corrigir a cifra.

- **Mapa de sincronização:**
  - O editor mantém um identificador estável para cada linha do ChordPro, preservado ao editar o texto da linha e descartado se a linha for apagada.
  - O mapa guarda `{lineId: início em segundos}`.
  - Linhas novas ficam sem tempo e herdam por interpolação entre as vizinhas.
- **Destaque no player:**
  - A linha atual vem do mapa.
  - O acorde atual é o acorde da linha atual mais próximo da posição proporcional ao tempo dentro da linha, a mesma regra usada na geração (§7.6).
  - O player segue sempre a **cifra editada**; os acordes brutos da análise servem só para gerar e regenerar.
- **Corrigir tempos:** modo "sincronizar". O usuário toca a música e toca na tela (ou aperta espaço) no início de cada linha; isso regrava os tempos das linhas. Também é possível ajustar o tempo de uma linha diretamente.
- **Exportação:**
  - O mapa vai em `analysis.json` (ou num `sync.json` no pacote), indexado pela ordem das linhas no `chart.cho` exportado.
  - O ChordPro continua padrão, sem diretivas inventadas.
- **Reanálise de uma música com cifra `edited`:** não sobrescreve. Gera uma cifra nova e pergunta se o usuário quer substituir ou manter a atual. Cifras `generated` (nunca editadas) são substituídas sem perguntar.

## 6. Modelos

| Função | Modelo (Hugging Face) | Tamanho | Licença | Entrada e saída (das fichas dos modelos) |
|---|---|---|---|---|
| Tom | `musetric/skey-onnx` | 0,3 MB | MIT | Áudio inteiro, 22050 Hz mono, normalizado pelo pico → 24 probabilidades (ordem em `config.json → keyMap`). Usar `argmax`; a "confiança" não é calibrada. Rodar na faixa instrumental quando existir; senão na mixagem |
| Acordes | `musetric/chordmini-onnx` | 17 MB | MIT | 22050 Hz mono com mixagem **média** `(L+R)/2` → log-CQT (plano fornecido com o modelo, equivalente ao librosa 0.11; hop 2048, 144 bins, 24 por oitava) → janelas de 108 quadros em grupos de 16 (preencher o último grupo) → logits `[16,108,170]` → suavização (kernel 9) + argmax. Quadro ≈ 0,0929 s. Vocabulário de 170 acordes em `config.json → chordVocab` |
| Batida e compasso | `musetric/beat-this-onnx` | 190 MB | MIT | Ver a ficha (usa `mel-filterbank.bin`) |
| Voz / instrumental | `musetric/mel-band-roformer-duality-student-onnx` | 213 MB | Apache-2.0 | 44,1 kHz estéreo → STFT (n_fft 2048, hop 441) em janelas fixas T=1100 (~11 s) → máscaras complexas → iSTFT no app |
| 6 faixas | `StemSplitio/htdemucs-6s-onnx` (`htdemucs_6s_fp16weights.onnx`) | 136 MB | MIT | Ver a ficha. Faixas: drums, bass, other, vocals, guitar, piano |

Regras do gerenciador de modelos:
- Baixar só quando o recurso for usado pela primeira vez, com tamanho informado antes e barra de progresso.
- Fixar cada modelo por commit (revisão) do repositório no Hugging Face e conferir o SHA-256 depois do download.
- **Fonte na V1:** só o Hugging Face (as URLs `resolve/<revisão>/` aceitam chamadas do navegador). *(Decisão do Claude.)*
  - **Espelho de reserva:** fica para depois. Se for criado, será outro repositório no Hugging Face sob a conta do projeto, com os mesmos hashes.
  - **Releases do GitHub não servem:** não enviam cabeçalhos CORS.
  - O gerenciador já aceita uma lista de fontes, para o espelho entrar sem refatoração.
- Guardar em Cache Storage ou OPFS; listar e permitir apagar nas configurações.
- **Pacotes de download** *(decisão do Claude)*:
  - **"Análise básica"** (tom + acordes, ~17 MB): padrão, inclusive no celular.
  - **"Batidas"** (~190 MB): opcional. Melhora as linhas instrumentais por compasso e é recomendado no computador.
  - **"Separação"** (voz/instrumental, ~213 MB).
  - **"Separação 6 faixas"** (~136 MB).
- **Sem o modelo de batidas, a geração da cifra continua funcionando:** as linhas instrumentais agrupam os acordes por mudança de acorde, não por compasso.

## 7. Funcionalidades e critérios de aceite

### 7.0 Fase 0: validação dos acordes (antes de qualquer tela)
Um script ou página de teste que roda S-KEY + ChordMini + Beat This em músicas de referência e imprime a sequência de acordes por compasso.

**Músicas** (aprovadas pelo usuário, arquivos locais em `C:\Users\WillCruz\Music`, nunca enviados para fora nem versionados no repositório):

| # | Música | Arquivo | Estilo | Referência extra |
|---|---|---|---|---|
| 1 | Imperfeito (Coral Canto Jovem e Rayssa Andreoli) | `IMPERFEITO  Coral Canto Jovem e Rayssa Andreoli - Seven Plus (youtube).mp3` | Louvor / coral | Pasta ao lado com faixas já separadas (vocals, piano, keys, strings, other) e tom identificado: Lá maior, 190 BPM |
| 2 | Ninguém Explica Deus (Preto no Branco ft. Gabriela Rocha) | `Spotify\Adorar\Preto no Branco - Ninguém Explica Deus (Ao Vivo) ft. Gabriela Rocha.mp3` | Louvor com banda | |
| 3 | Olhos Coloridos (Seu Jorge, Sandra de Sá) | `Spotify\AnyOne\Seu Jorge, Sandra De Sá - Olhos Coloridos.mp3` | MPB / soul | Harmonia mais rica |
| 4 | Primeiros Passos (Ton Carfi) | `Mel\Ton Carfi - Primeiros Passos (DVD Ton Carfi 20 Anos) - Ton Carfi (youtube)-G-118bpm-441hz.mp3` | Louvor pop | Tom identificado: Sol, 118 BPM |
| 5 | Boulevard of Broken Dreams (Green Day) | `Spotify\00s Rock Anthems\Green Day - Boulevard Of Broken Dreams [Official Music Video] [4K Upgrade].mp3` | Rock | Controle fácil |

- **Cifra de referência:** o Claude monta a sequência de acordes esperada de cada música, e o usuário (músico) confirma ou corrige antes da comparação.
- **Métrica** *(decisão do Claude)*: porcentagem de compassos cujo acorde principal tem fundamental e tipo (maior/menor) corretos. Para o tom: acerto exato ou relativo, reportados separadamente.
- **Gate** *(decisão do Claude)*: média ≥ 70% → seguir normalmente.
- **Se ficar abaixo de 70%** (decisão do usuário): testar uma alternativa barata (Essentia.js) e ficar com a melhor. A V1 segue de qualquer forma, apresentando a cifra gerada como **rascunho editável** ("confira os acordes"). Exportar outros modelos para ONNX (ex.: BTC) não faz parte da V1.

### 7.1 Base
- PWA instalável (manifest, ícones, service worker); o app abre offline depois da primeira visita.
- Tema claro e escuro.
- Atualização do app avisa o usuário e não interrompe um job em andamento.

### 7.2 Biblioteca
- Lista de músicas com busca por título/artista, filtro por favoritos e tags.
- Criar música por: (a) envio de áudio; (b) cifra nova ou colada, sem áudio; (c) importação de pacote.
- Excluir música remove os arquivos do OPFS.

### 7.3 Adicionar música (áudio)
- Aceitar MP3, WAV, M4A/AAC e OGG, desde que o navegador decodifique.
- Ler título, artista e duração das tags (ID3 e equivalentes); o usuário confirma ou corrige antes da análise.
- Guardar o áudio original no OPFS.

### 7.4 Análise
- Ordem: tom, acordes e batidas; depois letra (se houver internet); depois a geração da cifra.
- Progresso por etapa, cancelável.
- Sem WebGPU: rodar em WASM e avisar que será mais lento.
- Sem suporte de memória ou processamento: falhar com mensagem clara e manter a música utilizável para cifra manual.

### 7.5 Letra
- Buscar no LRCLIB (`/api/search?track_name=&artist_name=`); mostrar os resultados (título, artista, duração, se tem letra sincronizada) e pré-selecionar o de duração mais próxima do áudio.
- Avisar quando a duração diferir mais de ~5 s (provável versão ao vivo ou outra versão).
- Sem resultado ou sem internet: o usuário cola a letra. Sem tempos, as linhas são distribuídas no tempo de forma aproximada e o usuário corrige no editor.

### 7.6 Geração e edição da cifra
- **Geração** *(algoritmo inicial; o construtor pode melhorar)*:
  - Para cada linha da letra com intervalo `[início, início da próxima)`, posicionar os acordes que começam nesse intervalo proporcionalmente ao tempo dentro da linha, encaixando no início da palavra mais próxima.
  - Trechos sem letra (intro, solos, finais) viram linhas instrumentais com os acordes por compasso, usando as batidas: `{comment: Intro}` + `[G] [D] [Em] [C]`.
  - Acordes repetidos em sequência são fundidos.
- **Editor:** texto ChordPro com pré-visualização ao lado (ou em abas no celular). Desfazer/refazer. Inserir acorde por toque na palavra (no celular) *(decisão do Claude)*.
- **Transposição** em semitons, preservando a grafia (sustenido ou bemol) adequada ao tom; capotraste; tamanho da fonte. Salvos por música.
- **Diagramas de acorde** (violão e teclado) dos acordes da cifra, num painel; posições de violão de um banco aberto (ex.: chords-db) e desenho com svguitar ou equivalente.

### 7.7 Separação de faixas
- Modo padrão voz/instrumental; modo 6 faixas opcional.
- Processar em janelas, com progresso; as faixas são salvas no OPFS (formato compactado a critério do construtor).
- Mixer: volume, mudo e solo por faixa; o player toca o mix das faixas quando elas existem.

### 7.8 Player
- Tocar o original ou o mix das faixas, com as faixas sincronizadas.
- Velocidade de 50% a 150% sem mudar o tom.
- Loop A-B.
- Destacar o acorde atual e a linha atual da cifra, com rolagem acompanhando a música.
- Sem áudio: rolagem automática com velocidade ajustável (como no cifras.app).
- Diagrama do acorde atual visível durante a reprodução *(decisão do Claude)*.

### 7.9 Setlists e modo palco
- Criar, renomear e excluir setlists; adicionar músicas da biblioteca; reordenar arrastando; tom por item.
- **Modo palco:**
  - Tela cheia, fonte grande, alto contraste, tema escuro por padrão.
  - Tela sempre acesa (Screen Wake Lock).
  - Próxima e anterior por toque, deslize ou teclas: setas, PageUp/PageDown e espaço, que é o que pedais Bluetooth de virar página enviam.
  - Transposição e tamanho da fonte acessíveis sem sair da tela.
  - Rolagem automática com velocidade ajustável.
  - Funciona sem internet e sem nenhum modelo baixado.
- Abrir uma música no modo palco leva menos de 1 s num celular intermediário *(meta do Claude)*.

### 7.10 Configurações
- Tema, fonte padrão, modo de separação padrão.
- Modelos: baixados, tamanhos, apagar.
- Armazenamento: espaço usado, status de persistência.
- Backup: exportar tudo e importar.

## 8. Telas

Biblioteca · Nova música (envio, cifra manual, importação) · Processamento · Música (abas Cifra / Faixas / Info) · Editor de cifra · Player (barra fixa, expansível) · Setlists · Editor de setlist · Modo palco · Configurações.

Visual: seguir o cifras.app (shadcn/ui, tema claro/escuro, verde esmeralda `hsl(160 84% 39%)` / `45%` no escuro, raio 0,5 rem) *(decisão do Claude, com base no app anterior)*. Celular primeiro nas telas de palco, setlist e cifra; computador primeiro nas de processamento e faixas.

## 9. Licenças

- **Licença do projeto:** MIT *(decisão do Claude)*.
- **Dependências:** só licenças permissivas (MIT, Apache-2.0, BSD, ISC). Evitar GPL e LGPL no bundle, por exemplo bibliotecas de time-stretch GPL.
- **Modelos:** só MIT ou Apache-2.0.
  - Excluídos: `Tsumugi-Chords` (não comercial), `YourMT3+` (dados de treino não comerciais), `musetric/vocal-separation-roformer-onnx` (licença não confirmada).
  - O modelo "kara2" do Musetric (voz principal / backing) não entra na V1 sem conferir a licença.
- **Atribuições** de código e modelos de terceiros num `THIRD_PARTY_NOTICES.md`.
- **Conteúdo:** o app nunca envia áudio do usuário para servidores. A única chamada de rede com dados da música é a busca no LRCLIB (título, artista e duração).

## 10. Testes e qualidade

- Testes unitários para: transposição e grafia de acordes, conversão de rótulos (`C:min7` → `Cm7`), leitura e escrita de ChordPro, geração da cifra a partir de análise + letra, exportação e importação do pacote.
- Testes de pipeline com áudio curto de referência (gerado ou de domínio público) comparando com saídas conhecidas. O Musetric e as fichas dos modelos trazem valores de referência.
- Testes manuais em: Chrome desktop, Edge desktop, Chrome Android, Safari iOS.

## 11. Deixado para o construtor

- Bibliotecas específicas:
  - IndexedDB: Dexie ou similar;
  - zip: fflate ou similar;
  - leitura de tags de áudio;
  - time-stretch;
  - roteamento (React Router ou TanStack Router);
  - gerenciamento de estado (zustand, como no cifras.app).
- Formato de compressão das faixas no OPFS.
- Nomes exatos de campos e telas, desde que respeitem §5.
- Estratégia de cache dos modelos (Cache Storage ou OPFS).
- Detalhes do pré e pós-processamento de Beat This e htdemucs_6s, conforme as fichas e o código do Musetric.
- Organização do código (monorepo ou não), CI e hospedagem estática.
