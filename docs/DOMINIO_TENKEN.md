# Contrato de domínio — Tenken

Autor: Claude Code. Data: 10/09/2026.
Situação: Wagner informou que os créditos do GPTCodex acabaram no meio da rodada MED01.
A partir deste ponto, Claude Code assume também os arquivos que estavam com o GPTCodex.
O registro da passagem está em `COORDENACAO_AGENTES.md`.

Este documento define o que a interface, a impressão e o futuro backend consomem.
Onde a frase diz **está implementado**, existe código e teste. Onde diz **especificado**,
é decisão de contrato ainda sem implementação. Nada aqui foi validado em tablet físico.

## 1. Fonte única

O PDF `様式原本_全日本トラック協会_点検整備記録簿 (1).pdf` é a única referência de
itens, símbolos e estrutura. As 100 linhas estão extraídas em
`docs/source/tenken-20260910/catalogo_pdf_100_itens.json`, com texto japonês,
componente, coluna/linha de origem, coordenadas da célula de resposta, notas ※ e a
periodicidade transcrita do sombreado. O Excel é histórico e não acrescenta itens.

O identificador de uma linha é `pdf-NNN`, estável, atribuído na extração. É esse
identificador que a tradução, a resposta, a medição e a impressão usam. Nunca usar
o texto japonês como chave.

## 2. Identidade do veículo

Três conceitos distintos, que não devem ser confundidos:

| Campo | O que é | Regra |
| --- | --- | --- |
| `vehicleId` | Registro do veículo na frota | Ligação durável. Preenchido quando o caminhão é escolhido do cadastro. Ausente quando a placa é digitada à mão. |
| `registration` | Placa como estava no dia | Instantâneo. É o que sai impresso. Nunca reescrito depois. |
| `vehicleKey` | Placa normalizada | Só busca e agrupamento. NFKC, sem espaços, maiúscula, hífen preservado. Não é identidade. |

**Está implementado** em `admin-web/src/measurements/model.ts`: `vehicleId` opcional na
sessão, `registration` obrigatório, `vehicleKey` derivado e validado contra `registration`.
Digitar a placa à mão apaga o `vehicleId`, para não apontar para outro veículo.

**Especificado, não implementado:** quando o backend existir, `vehicleId` passa a ser
obrigatório para inspeções de frota, e a busca por `vehicleKey` vira conveniência.
Uma troca de placa (移転登録) cria um novo `registration` sem partir o histórico,
porque o histórico segue o `vehicleId`.

## 3. Resposta do item e ação de manutenção são coisas separadas

Cada linha do PDF tem uma célula de resultado, onde vai o símbolo, e a possibilidade
de uma ação de manutenção. São campos distintos: um item pode estar verificado sem
ação, ou ter ação registrada. Nenhum item começa aprovado. Medição não responde item.

**Está implementado** na prévia das 100 linhas (`demo/pdf-preview/state.ts`) e a
separação é respeitada pelas medições (`measurements/inspection.ts` só semeia cabeçalho).

## 4. Medições

### 4.1 Métricas e a linha do PDF que cada uma preenche

| Métrica | Linha do PDF | Texto original |
| --- | --- | --- |
| `tireTread` (sulco do pneu) | `pdf-036` | タイヤの状態(※1) |
| `brakePad` (pastilha, freio a disco) | `pdf-029` | パッドの摩耗(※1) |
| `brakeLining` (lona, freio a tambor) | `pdf-025` | シューの摺動部分及びライニングの摩耗(※1) |

Pastilha e lona são métricas diferentes de propósito. Um caminhão a tambor não tem
pastilha; registrar a lona como pastilha imprimiria um componente que o veículo não
possui e apontaria para a linha errada do formulário. Um caminhão pode ter disco no
eixo dianteiro e tambor atrás; as duas métricas coexistem na mesma inspeção, em
posições diferentes, sem uma sobrescrever a outra.

**Está implementado**, com teste que compara o texto japonês contra o JSON de origem.

### 4.2 Posição

`{ axle, side, wheel }`. Eixos de 2 a 4. Pneu pode ser `single`, `inner` ou `outer`
conforme a configuração do eixo. Pastilha e lona são sempre `single`: uma por lado
por eixo, mesmo em roda dupla. A chave de posição é
`metric:axle:side:wheel`, e é ela que define uma casa de medição.

Reboques e semirreboques (トレーラー) ficam fora: têm formulário próprio.

### 4.3 Valor e procedência

`valueMm` de 0 a 100 mm com até duas casas. **Essa é a faixa de digitação, não um
critério legal de aprovação.** O sistema não julga a peça.

`source` é `manual`, `simulator` ou `bluetooth`. Leitura por Bluetooth exige o nome
do aparelho. Leitura de simulador é sempre identificada como tal na tela, no
histórico, no relatório japonês e no resumo impresso.

### 4.4 Simulação nunca entra no histórico real

Uma inspeção é ou um ensaio ou trabalho real, nunca os dois. Uma sessão que contém
leitura de simulador é guardada em `susumu.tenken.measurements.demo.v1`; as demais em
`susumu.tenken.measurements.v1`. O roteamento é decidido pelo conteúdo da sessão, não
pelo chamador. Uma retificação também não pode introduzir valor simulado no histórico
real. O mínimo impresso no formulário nunca mistura as duas origens.

**Está implementado** em `measurements/storage.ts`, com testes.

### 4.5 Retificação

Corrigir é acrescentar uma leitura nova com `supersedesId` e motivo. O registro
original permanece e continua sendo impresso, marcado como 訂正済. A ordem da cadeia
vem da posição no vetor, que é somente-acréscimo, **não do relógio**. Um tablet que
ficou offline pode ter o relógio ajustado para trás; a correção feita depois disso
continua válida. `capturedAt` é informação registrada, não critério de ordenação.

Motivos aceitos hoje: `remeasurement` (再測定) e `inputCorrection` (入力訂正). Motivo
livre é preservado no registro e **bloqueia a impressão** até haver japonês conferido.

**Está implementado**, com teste do relógio para trás.

## 5. Hora

A hora oficial impressa é a do tablet, conforme decisão de Wagner (D5). Ela é gravada
em UTC e exibida em horário do Japão.

**Especificado, não implementado:** quando houver servidor, gravar também a hora do
servidor no momento do envio e um indicador de confiança do relógio do tablet. A
impressão continua mostrando a hora do tablet; a hora do servidor serve para auditoria.

## 6. Idiomas

Interface japonesa só em japonês. Interface brasileira só em português. Os dois modos
operam os mesmos registros. A impressão é sempre em japonês, no layout do PDF.

Observação digitada em português exige versão japonesa conferida antes da emissão
final. O texto original não pode ser perdido nem omitido em silêncio.

**Está implementado** desde 10/09/2026:

- O aplicativo abre em **japonês**. A oficina fica no Japão; o português é a escolha
  que o mecânico brasileiro faz, não o contrário.
- A escolha é uma só para todo o aplicativo, guardada em
  `susumu.tenken.language.v1`, e sobrevive a recarregar a página. Trocar o idioma em
  qualquer tela troca em todas: a bancada de medições, a prévia das 100 linhas e a
  coleta do 車検証 recebem a escolha da casca e devolvem a alteração.
- O controle são duas bandeiras, Japão e Brasil, cada uma com o nome do idioma
  escrito na própria língua. Fica no alto da primeira página, ao lado do estado da
  rede. As bandeiras são desenhadas no próprio código, não são arquivos de imagem,
  para que funcionem sem rede no tablet.
- O idioma escolhido também define o formato de data e de número na tela.
  `document.documentElement.lang` acompanha a escolha.
- Trocar de idioma **não grava nada** na inspeção: é só leitura da mesma ficha.
- O catálogo de 12 itens da demonstração tem os dois idiomas por identificador
  estável (`labelJa`, `hintJa`, `sectionJa`), e as mensagens que impedem finalizar
  saem no idioma da tela. O registro salvo continua sem idioma.

Isso não muda a impressão: ela permanece só em japonês, no layout do PDF, qualquer
que seja o idioma da tela.

## 7. Completude antes de imprimir

**Especificado, parcialmente implementado.** Já existem três bloqueios de impressão:
motivo de retificação sem japonês, resumo de medições que não cabe na área livre do
formulário, e ficha cuja identificação não confere com a sessão de medições.

Falta a verificação de itens obrigatórios em branco: listar, no idioma da tela, as
linhas do PDF que ainda não têm resposta e impedir a emissão final. Essa é a barreira
contra 記入漏れ que o vídeo da KTC identifica como a principal perda de confiança do
cliente. Ver `docs/estudos/2026-09-10-estudo-ktc-e-seibi.md`.

## 8. O que este contrato não decide

- Quais linhas do PDF são obrigatórias em cada periodicidade. O JSON traz a
  periodicidade transcrita do sombreado, mas as dispensas das notas ※1 ※2 ※3
  dependem de condição do veículo e não são aplicadas automaticamente.
- Protocolo de nenhum instrumento Bluetooth. Nenhum perfil de fabricante foi
  validado; `SUPPORTED_GAUGE_PROFILES` está vazio de propósito.
- Sincronização entre tablets. O armazenamento atual é local ao navegador.
- Registro de aperto de porcas de roda (ホイールナット). Não está nas 100 linhas.
