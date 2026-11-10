# Experimento LV-Chordia

**Estado atual:** LV-Chordia integrado à análise padrão de MP3, com blocos limitados e SKey para o tom.
Execução integral no navegador, sem Python durante o uso. Veja a seção final
"Versão integral no navegador"; as seções anteriores preservam o histórico dos testes.

O histórico abaixo descreve a prova de viabilidade. A análise padrão e o modal inicial agora usam os
arquivos publicados em `apps/web/public/models/lv-chordia-v1`. O painel de comparação continua opcional em desenvolvimento.
Sem commit/push automático. Modelos, ambiente Python, áudio e relatórios detalhados ficam em pastas ignoradas.

## Escopo

- Converter os cinco checkpoints oficiais para ONNX com seis saídas: tríade, baixo, 7ª, 9ª, 11ª e 13ª.
- Comparar PyTorch, ONNX Runtime CPU e ONNX Runtime Web/WASM.
- Conferir a execução em um trecho local, sem envio de áudio a servidores.
- Separar equivalência numérica de precisão musical: ainda não existe uma referência harmônica humana para pontuar o trecho.

Fonte fixada: https://github.com/openmirlab/lv-chordia/tree/d8ab9ac99bce081bb79065d717f96e2c3b2099c8
O repositório declara MIT. Os arquivos convertidos da integração acompanham a distribuição, com atribuição em `NOTICE.txt`.

## Preparação (PowerShell, na raiz do projeto)

Requer Python 3.12, Git, FFmpeg e as dependências npm já instaladas do projeto.

```powershell
python -m venv tools/lv-chordia/.venv
git clone https://github.com/openmirlab/lv-chordia.git tools/lv-chordia/.cache/upstream
git -C tools/lv-chordia/.cache/upstream checkout d8ab9ac99bce081bb79065d717f96e2c3b2099c8
& tools/lv-chordia/.venv/Scripts/python.exe -m pip install torch==2.15.0+cpu --index-url https://download.pytorch.org/whl/cpu
& tools/lv-chordia/.venv/Scripts/python.exe -m pip install -r tools/lv-chordia/requirements.txt
```

## Conversão e equivalência sintética

```powershell
& tools/lv-chordia/.venv/Scripts/python.exe tools/lv-chordia/experiment.py
node tools/lv-chordia/wasm-parity.mjs
```

O export usa batch fixo 1 e eixo temporal dinâmico, opset 17 e o exportador TorchScript.
Os avisos de InstanceNorm e LSTM são preservados no terminal. Não foram ignorados como prova de correção:
comparamos todas as saídas para dois comprimentos diferentes (96 e 192 quadros).
Os hashes dos checkpoints são conferidos antes da leitura. Modelos exportados recebem SHA-256 no manifesto.

## Trecho real

```powershell
ffmpeg -v error -nostdin -n -ss 60 -t 30 -i 'CAMINHO_LOCAL_DA_MUSICA.mp3' -ar 22050 tools/lv-chordia/.cache/trecho.wav
& tools/lv-chordia/.venv/Scripts/python.exe tools/lv-chordia/audio-probe.py tools/lv-chordia/.cache/trecho.wav
node tools/lv-chordia/wasm-parity.mjs 1292
```

O número de quadros é informado pelo relatório Python; 1292 corresponde ao trecho de 30 s utilizado.
O WAV conserva os canais; a média mono é feita pelo script. O CQT segue os parâmetros do código upstream,
incluindo afinação automática e recorte dos bins 18:270. O decodificador continua sendo o Python de referência.

`wasm-parity.mjs` sai com código 1 se qualquer saída ultrapassar `atol=1e-4, rtol=1e-3`.
Não aumente a tolerância apenas para obter aprovação. Para investigar otimizações:

```powershell
$env:LV_DISABLE_OPT='1'
node tools/lv-chordia/wasm-parity.mjs 1292
Remove-Item Env:LV_DISABLE_OPT
```

## Resultado inicial — 09/11/2026

Ambiente: Windows, Python 3.12.14, PyTorch 2.15.0+cpu, ONNX Runtime 1.31.1 e
onnxruntime-web 1.31.1, WASM com uma thread sob Node 24.22.2. Librosa 1.0.0.
Tempos pontuais, sem repetição estatística e sem medição de memória.

| Verificação | Resultado |
|---|---|
| Base atual do motor | 137 testes passaram |
| Exportação | Cinco ONNX, 1.886.875 bytes cada; 9.434.375 bytes no total |
| PyTorch × ONNX CPU, entradas sintéticas | Passou; todas as seis saídas, 96 e 192 quadros, cinco redes |
| PyTorch × WASM, entradas sintéticas | Passou para a rede 0 nos dois comprimentos |
| Trecho real | 30 s de Imperfeito, a partir de 01:00; arquivo exclusivamente local |
| PyTorch × ONNX CPU, trecho real | Passou (`atol=2e-4, rtol=1e-3`); cinco redes; mesmos rótulos finais |
| Decodificador completo | 2.737 candidatos após filtros/limites da rede; produziu `A:maj/5` no trecho |
| PyTorch × WASM, trecho real | **Falhou a tolerância numérica**, rede 0; maior erro absoluto ~0,02473 |
| Argmax das seis saídas no WASM, trecho real | 100% de concordância neste trecho; não equivale a validar o ensemble/HMM |
| WASM sem otimização de grafo | Mesma divergência; não solucionou |

O CQT levou 8,37 s na primeira execução (inclui inicializações/JIT); as cinco inferências
ONNX CPU somaram cerca de 0,79 s. Uma rede WASM levou ~0,71 s nos 30 s de características.
Esses números não medem o fluxo completo no navegador nem permitem extrapolar para iPhone ou música inteira.

O suporte a extensões é real no código, mas uma inversão produzida não comprova acerto auditivo.
As referências existentes em docs/fase0 contêm N.C. e não servem como ground truth.

## Próximos critérios antes da integração

1. Localizar a origem da divergência WASM em entradas reais; comparar camadas/normalização antes de mudar tolerâncias.
2. Validar cinco redes e decodificador juntos no WASM em mais músicas e comprimentos.
3. Reproduzir o CQT e a conversão dos nomes em TypeScript/WASM, preservando equivalência.
4. Comparar ChordMini e LV-Chordia em trechos anotados pelo músico, incluindo inversões e tensões.
5. Medir memória e tempo no Chrome e Safari/iPhone reais.

Conclusão inicial: havia viabilidade de exportação e execução WASM, com divergência real ainda pendente.

## Evolução: normalização e interface experimental

O rastreamento por camadas (`trace.py`, `trace.mjs`) localizou a primeira divergência relevante na
normalização: a primeira convolução diferiu em ~9,54e-7; a primeira normalização em ~0,00685.
Desligar otimizações e trocar apenas a fórmula da variância não resolveu.

A exportação `--centered-norm` substitui InstanceNorm não afim por subtração da média e variância
centrada, reduzindo os eixos espaciais separadamente (frequência e depois tempo). Evita a redução
única muito extensa. É uma mudança de implementação numérica, sem retreinar ou modificar os pesos.

Na rede 0, no mesmo trecho real, a comparação WASM contra o PyTorch original passou com a tolerância
original, sem relaxá-la: maior diferença absoluta entre as seis saídas ~5,11e-5.
O ensemble completo executado no worker real com a ponte HTTP retornou os mesmos 12 rótulos
do Python e exibiu a inversão `A/E`. Fluxo medido pontualmente em 12,58 s para 30 s de áudio.
Essa execução foi sob Node usando o worker da aplicação; não é validação visual ou de iPhone.

Para exportar e habilitar o laboratório:

```powershell
& tools/lv-chordia/.venv/Scripts/python.exe tools/lv-chordia/experiment.py --centered-norm
npm run dev:chords
```

Abra http://127.0.0.1:5175, importe/abra uma música e expanda **Laboratório de acordes · LV-Chordia
experimental**. Escolha início e duração (15, 30 ou 60 segundos) e clique **Comparar acordes**.
O início padrão é 60 segundos; para músicas menores, escolha um valor menor que sua duração.
Cada acorde pode ser tocado para iniciar o player naquele tempo. Nenhum resultado sobrescreve a cifra.
Use desktop neste primeiro experimento; a ponte aceita somente conexões loopback.

**Limitação explícita:** as cinco redes rodam em WASM no navegador, porém CQT e decodificador ainda
executam em Python neste computador por middleware do Vite. Nada é enviado para serviços externos.
Não funciona em deploy, offline independente do auxiliar, celular na rede ou `npm run preview`.
`npm run dev` normal não habilita a ponte; `WM_LV_EXPERIMENT=1` é configurado pelo comando experimental.
O build de produção não inclui o painel, worker experimental ou pesos. Portas/hosts diferentes têm
bibliotecas e caches diferentes; a biblioteca existente em localhost:5173 não aparece em 127.0.0.1:5175.

O auxiliar limita o áudio a 60 segundos, não aceita caminhos enviados pelo cliente, valida a origem
HTTP, aplica timeout e remove os arquivos temporários de cada solicitação. O cancelamento encerra
o worker; um cálculo Python já iniciado pode terminar antes da limpeza (limitado a dois minutos).

Ainda falta comparar musicalmente com referências humanas, validar cinco redes numericamente em
mais entradas reais e portar CQT/decodificador para executar o fluxo inteiro no navegador.
O modelo padrão permanece ChordMini até essas validações.

## Versão integral no navegador

O laboratório na rota `/musica/:id` agora executa afinação, CQT, cinco redes e Viterbi no worker.
O servidor fornece somente arquivos estáticos. Endpoints de processamento POST foram removidos.
Python é usado apenas para preparar os artefatos e gerar referências de verificação offline:

```powershell
& tools/lv-chordia/.venv/Scripts/python.exe tools/lv-chordia/experiment.py --centered-norm
& tools/lv-chordia/.venv/Scripts/python.exe tools/lv-chordia/prepare-browser.py
npm run dev:chords
```

Planos CQT estáticos: 100 afinações, aproximadamente 14,5 MB no conjunto; o navegador carrega apenas
o plano selecionado (aproximadamente 145 KB) e verifica SHA-256, assim como modelos e dicionário.
O conjunto de cinco redes normalizadas ocupa 9.472.785 bytes. Cache é opcional; recusa de cota
não impede a execução da sessão. Áudio e características não são enviados ao servidor.

O CQT TypeScript reproduz a referência com `res_type='polyphase'`, em vez do SoXR do fluxo inicial.
No trecho real, erro RMS relativo ~1,21e-7 e mesma sequência de 12 acordes. Três exemplos sintéticos
com afinações -0,41, 0,26 e 0,45 também concordaram na afinação e tiveram erro RMS <1,5e-7.
Isso valida o porte do pré-processamento; não é uma medida de precisão harmônica geral.

No navegador de validação, a fixture de 30 s foi processada em ~4,7 s. Foi verificado pela interface:
resultado A/E, diagramas de violão/teclado/cavaquinho, e aplicação à cifra gerada da fixture.
A comparação é preservada mesmo depois de aplicar. Resultados só entram no banco ao clicar
"Aplicar acordes ao trecho" e confirmar. Cifras editadas manualmente nunca são regeneradas por essa ação.

Os diagramas do laboratório usam verificação estrita: notas permitidas, baixo solicitado e limite
de cordas. Sem posição compatível, mostram "Sem diagrama". Para extensões com mais notas que cordas,
somente a quinta justa pode ser omitida; nenhuma extensão é truncada silenciosamente.

O teste continua limitado a 60 s por execução para controlar memória. O worker é encerrado ao
cancelar/sair. Continua opt-in e limitado à tela de música: outras rotas e o modelo padrão não mudam.
A porta 5175 tem biblioteca/cache separados de outras portas. Não está habilitado no deploy.

Verificação reproduzível após preparar as referências:

```powershell
node --import tsx tools/lv-chordia/validate-browser.mjs
node --import tsx tools/lv-chordia/interface-smoke.mjs
```

`interface-smoke.mjs` executa o worker real sob Node e compara a saída; a validação visual foi feita
separadamente no navegador. Não confundir esses resultados com medição no Safari/iPhone.

## Integração padrão — 09/11/2026

O worker de análise padrão usa cinco redes LV-Chordia para acordes e mantém SKey para o tom.
Novas importações usam esse fluxo. Para uma música existente, use **Analisar de novo** na tela da música.
O pipeline conserva letras existentes e seus tempos, reconstrói cifras geradas e protege cifras editadas.
A posição de acordes nas palavras continua sendo aproximada pelo tempo de cada linha; esta mudança não cria alinhamento palavra a palavra.

A inferência trabalha com núcleos de 30 segundos, mais 5 segundos de contexto em cada lado.
Somente o núcleo de cada resultado é retido, com tempos absolutos e união de rótulos iguais adjacentes.
Isso limita características e Viterbi a blocos de até 40 segundos. O MP3 ainda é decodificado por inteiro pelo fluxo existente.
O contexto reduz efeitos de borda, mas não promete equivalência com uma inferência única da música inteira.

As cinco redes somam 9.472.785 bytes; planos ZIP e dicionário elevam o pacote LV a **15.438.558 bytes**.
Com SKey, o grupo inicial de acordes e tom tem **15.777.040 bytes**. O runtime WASM já pertence à aplicação.
ZIP permite descompactar apenas o plano da afinação em uso. Os downloads são conferidos por SHA-256 e
ficam no cache comum de modelos, visíveis/removíveis em Ajustes. Uma cópia da sessão evita novos downloads
entre blocos quando o navegador recusa gravar o cache. O ChordMini permanece apenas para o microfone, sob demanda;
seu cache antigo não é removido automaticamente.

Para reproduzir os arquivos de distribuição após a preparação descrita acima:

```powershell
node tools/lv-chordia/package-browser.mjs
node --import tsx tools/lv-chordia/integration-smoke.mjs
```

O smoke usa a fixture local de áudio já preparada e o SKey local de tools/phase0/.cache/models.
Exercita inferência WASM real, cobertura de 65 segundos e o protocolo do worker padrão. Não mede Safari/iPhone.
Não é necessário iniciar dev:chords: **npm run dev** e o build de produção incluem a integração.
