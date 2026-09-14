# Revisão de domínio — medições (MED01)

Revisor: Claude Code, sessão interativa do VS Code (ref. CC-20260910-e4c828be).
Data: 10/09/2026, 15:15–15:40 JST. Escopo: leitura integral de
`admin-web/src/measurements/{model,storage,inspection,draft,print,bluetooth}.ts`,
`MeasurementReport.tsx`, trechos de `MeasurementStudio.tsx` (init, simulate, connect,
capture, save, correct, print) e pontos de integração em `pdf-preview/PdfPreview.tsx`
e `OriginalForm.tsx`. Código na versão de 15:14 JST; Codex ainda editava.
Testes executados por mim: `npm test -- src/measurements` → 7 arquivos, 66 testes, todos aprovados.
Nenhum arquivo de implementação foi editado por este revisor.

Legenda: **B** = bloqueia aceite para piloto físico; **A** = corrigir antes de integrar ao domínio; **N** = nota, sem ação obrigatória.

## Verificado e aprovado

- Valor medido separado do símbolo de resultado: `inspection.ts:23-33` só semeia cabeçalho; nenhuma resposta é preenchida. Correto.
- Origem por leitura (`manual|simulator|bluetooth`) em `model.ts:3`, exigida e validada em `model.ts:224-226`. Correto.
- Retificação como nova leitura com `supersedesId` + motivo, original preservado: `storage.ts:86-106`, cadeia validada em `model.ts:243-274`. Correto.
- Nenhum limiar legal, nenhuma aprovação automática: faixa 0–100 mm em `model.ts:104-111` é só faixa de entrada, comentado. Correto.
- Vínculo com as 100 linhas: `print.ts:25-27` → pdf-036 (タイヤの状態) e pdf-029 (パッドの摩耗). Conferi no `catalogo_pdf_100_itens.json`: IDs e textos batem.
- Impressão japonesa: relatório `MeasurementReport.tsx` todo em JA; resumo no PDF só na área vazia de その他点検・整備項目 (`print.ts:12-18`), bloqueado se não couber (`print.ts:80-87`, `OriginalForm.tsx:86`). Original intacto.
- Simulação identificada em todos os pontos: fonte, nome do aparelho "模擬計測器", cabeçalho "見本・未確定／模擬測定を含む" (`MeasurementReport.tsx:33,105-107`), resumo "見本・模擬" (`print.ts:51`).
- Bluetooth: sem UUID inventado, `SUPPORTED_GAUGE_PROFILES` vazio (`bluetooth.ts:16-18`); gesto do usuário, cancelamento, timeout e quadro inválido tratados. Honesto e correto.
- Motivo de correção livre gera pendência de japonês e bloqueia impressão (`print.ts:109-128`, `MeasurementStudio.tsx:1303`). Correto.

## Falhas concretas

### B1 — Caminhão com freio a tambor não tem pastilha; o PDF tem a linha certa e o modelo não

`model.ts:2` define `Metric = "tireTread" | "brakePad"`; `print.ts:25-27` liga toda espessura de freio a pdf-029 (パッドの摩耗, freio a disco).
O PDF tem **pdf-025 「シューの摺動部分及びライニングの摩耗(※1)」** (tambor, 3 e 12 meses) e pdf-033 (センタ・ブレーキ, 12 meses).
Cena: mecânico mede a lona de um caminhão a tambor, só existe "ブレーキパッド厚さ", registra ali. O relatório japonês e o resumo impresso dizem "パッド" num veículo sem pastilha, e o vínculo aponta para a linha errada do formulário.
Correção: `Metric` ganha `brakeLining` → pdf-025, rótulo 「ライニング厚さ」; a tela escolhe pastilha ou lona por eixo (um caminhão pode ter disco na frente e tambor atrás). Não misturar num só campo.
Teste: sessão com `brakeLining` no 2º eixo imprime 「ライニング」 e vincula pdf-025; `brakePad` continua em pdf-029.

### B2 — Dados simulados entram no mesmo histórico persistente que dados reais

`MeasurementStudio.tsx:245-263` gera leitura `simulator`; `save()` (`367-406`) grava no mesmo `STORAGE_KEY` sem distinção; `storage.ts:67-84` aceita qualquer fonte.
Cena no piloto: alguém testa o botão "simular" com a placa real do caminhão e salva. O histórico daquele caminhão passa a ter valores fictícios. O relatório marca "模擬", mas a lista de histórico (`1111-1112`) só acrescenta um sufixo, e `buildMeasurementSummaryJa` calcula o mínimo misturando real e simulado (`print.ts:43-47`).
Correção: `saveSession` rejeita `source === "simulator"` fora de modo demonstração explícito (flag de build ou chave de storage separada `...measurements.demo.v1`). Mínimo impresso nunca considera leitura simulada.
Teste: `saveSession` com leitura simulada em modo normal → `INVALID_SESSION`; em modo demo grava em chave separada.

### A1 — Identidade do veículo é o texto da placa, não o veículo da frota

`model.ts:150-152` `normalizeVehicleKey` = placa em NFKC, sem espaços, maiúscula; hífen preservado de propósito. `MeasurementSession` (`21-32`) não guarda ID do veículo da frota; o cadastro da demo tem `vehicle.plate` (`MeasurementStudio.tsx:688`).
Cena: "品川100あ12-34" e "品川100あ1234" viram dois caminhões; troca de placa (移転登録) parte o histórico; dois tablets com grafia diferente idem. O próprio Codex pediu em NFC02 "vínculo expresso ao UUID da frota".
Correção: `vehicleId?: string` (UUID da frota) na sessão, com `registration` como snapshot da época; `vehicleKey` vira chave de busca, não identidade. Definirei isso no contrato de domínio (`docs/DOMINIO_TENKEN.md`).

### A2 — Correção rejeitada se o relógio do tablet andou para trás, com mensagem errada

`model.ts:263-269` exige `reading.capturedAt > prior.capturedAt` para aceitar `supersedesId`. `correct()` usa `new Date()` do tablet.
Cena: tablet offline por dias, relógio ajustado para trás por NTP ou fuso; mecânico corrige uma leitura → `INVALID_CORRECTION`, exibido como "conflict" (`MeasurementStudio.tsx:442-443`). Ele reenvia e falha de novo, sem saber por quê.
Correção: ordenar a cadeia pela posição no array (append-only já garante ordem), não pelo relógio; guardar `capturedAt` como informação. Mensagem própria para o caso. Alinha com a decisão D5 de Wagner (hora do tablet é a oficial, mas não é confiável como ordenação).
Teste: correção com `capturedAt` anterior ao original é aceita e aparece como 訂正済/採用中 corretamente.

### A3 — Rascunho inicial vem preenchido com placa fictícia "DEMO-714"

`MeasurementStudio.tsx:104-110`: sem rascunho salvo, a placa vira "DEMO-714", operador "見本担当者", km 182450.
Cena no piloto: primeiro uso no tablet real, mecânico mede e salva sem trocar a placa; sessão real fica sob DEMO-714.
Correção: pré-preenchimento só em modo demonstração; no piloto, placa e operador obrigatórios e vazios.

### A4 — Depois de "alreadySaved" o rascunho fica preso

`save()`: `saveSession` lança `DUPLICATE_ID` (`storage.ts:76-77`) → erro "alreadySaved" (`397-398`) e o `persist(... id novo ...)` da linha 388 não executa. O `id` do rascunho continua o mesmo; toda tentativa seguinte falha igual até recarregar a página. A proteção da carga inicial (`114-116`) não cobre esse caso.
Cena: duas abas com o mesmo rascunho; a segunda salva depois da primeira.
Correção: no `DUPLICATE_ID`, renovar o `id` do rascunho e informar que a sessão já existe no histórico.

### A5 — Modo Bluetooth oferecido sem nenhum perfil configurado

`MeasurementStudio.tsx:878` lista `bluetooth` como opção; `connect()` chama `getConfiguredProfile()` que retorna `undefined` (`bluetooth.ts:19-21`) → `PROFILE_REQUIRED` → "btError" genérico (`316-317`).
Cena: mecânico vê o botão, toca, recebe erro sem explicação, acha que o tablet está com defeito.
Correção: ocultar o modo quando `SUPPORTED_GAUGE_PROFILES` está vazio, ou mensagem específica "計測器のプロファイルが未設定です".

## Notas (N)

- N1 `model.ts:139-141,168-169`: eixos 2–4. Cobre caminhões rígidos da frota; reboques/semirreboques (トレーラー) têm formulário próprio e ficam fora, o que está correto para o PDF escolhido. Registrar como limite explícito.
- N2 `model.ts:176`: pastilha/lona uma por lado por eixo, mesmo em roda dupla. Correto mecanicamente.
- N3 `storage.ts:50-52`: detecção de escrita concorrente por comparação de string, não atômica. Suficiente para um tablet; a sincronização multi-tablet é do backend, não deste módulo.
- N4 `capturedAt` é hora do tablet em UTC, exibida em JST. Sem hora do servidor nem indicador de confiança do relógio (decisão D5). Fica para a integração com o backend; documentar no contrato.
- N5 `MeasurementStudio.tsx:74-83` exporta JSON via `<a download>`; funciona no Chrome do tablet, não funciona dentro de artefatos/sandbox. Só aviso.
- N6 `print.ts:44` resumo usa "溝" e "パッド" abreviados. Com B1 vira "溝/パッド/ライニング" e precisa recalcular o limite de largura (`measurementSummaryBox.width` 229 pt a 6–7 pt).

## O que falta para o aceite

1. B1 e B2 corrigidos com testes.
2. A1 entra no contrato de domínio que vou escrever em `docs/DOMINIO_TENKEN.md`; o Codex adapta `MeasurementSession` quando o contrato estiver publicado.
3. A2–A5: correções pequenas, autor Codex.
4. Aceite físico no Galaxy Tab Active5 Pro continua pendente e não é substituído por esta revisão.

Comunicação: enviado ao GPTCodex por `codex queue --thread 01a088f1-abf0-7d40-9f18-1de49b2ed34a` com ID CC-20260910-REV01.

---

# Fechamento — Claude Code assumiu a correção

Data: 10/09/2026, 15:40–16:10 JST. Wagner informou que os créditos do GPTCodex
acabaram. A última alteração do Codex no código é de 15:14 JST. A divisão de
arquivos combinada em MED01 fica encerrada; Claude Code passou a editar também
`admin-web/src/measurements/**`, `demo/pdf-preview/**` e a documentação de medições.
Ninguém escreveu resposta em nome do GPTCodex.

## Estado de cada achado

| Achado | Estado | Onde |
| --- | --- | --- |
| B1 pastilha × lona | Corrigido | `model.ts` métrica `brakeLining`; `print.ts` vincula a `pdf-025`; tela com três abas |
| B2 simulado no histórico real | Corrigido | `storage.ts` dois armazenamentos; bloqueio de mistura no rascunho e na gravação |
| A1 identidade do veículo | Corrigido em parte | `vehicleId` opcional na sessão e no rascunho; contrato completo em `DOMINIO_TENKEN.md` |
| A2 relógio para trás | Corrigido | `model.ts` ordena pela cadeia, não por `capturedAt` |
| A3 placa DEMO-714 pré-preenchida | Corrigido | Rascunho começa vazio; o caminhão de exemplo é uma escolha explícita |
| A4 rascunho preso após duplicata | Corrigido, e minha proposta original estava errada | Botão "Começar rascunho novo" |
| A5 Bluetooth sem perfil | Era pior no meu texto do que na realidade | Mensagem específica acrescentada |

## Correções à minha própria revisão

Duas coisas que eu escrevi acima não se sustentaram ao implementar. Registro para
não deixar um parecer errado no repositório.

**A4.** Eu propus renovar o identificador do rascunho quando a gravação acusa
`DUPLICATE_ID`. Isso não funciona e teria criado registros duplicados. Quando outra
aba já salvou a inspeção, as leituras daquele rascunho já existem no histórico com
os mesmos identificadores; renovar só o identificador da sessão faria a validação
global de unicidade recusar de novo, e se passasse, gravaria a mesma medição duas
vezes. O certo é oferecer o começo de um rascunho novo, que é o que foi feito.

**A5.** Eu afirmei que o mecânico veria um erro genérico ao tocar em Conectar sem
perfil configurado. O botão já estava desabilitado nessa situação (`MeasurementStudio.tsx`,
condição `!getConfiguredProfile()`), então o caminho de erro não era alcançável pelo
toque. A falha real era só a explicação vaga. Acrescentei uma frase específica.
A gravidade que atribuí estava alta demais.

## Verificação executada

- `npm test`: 27 arquivos, **271 testes aprovados**. Antes desta rodada eram 265.
  Seis testes novos: lona como métrica própria, vínculo com `pdf-025`, ensaio fora
  do histórico real, recusa de sessão mista, recusa de retificação simulada em
  histórico real, e aceite de retificação com relógio atrasado.
- `npm run lint`: sem alertas. `npm run build:demo` e `npm run build`: aprovados.
- Conferência no Chrome em `http://127.0.0.1:5174/demo.html#medicoes`: três abas de
  métrica; lona gera seis posições sem interno/externo; mistura de simulador com
  medição real recusada com a mensagem correta; sessão real em "Caminhões" e ensaio
  em "Demonstração", com aviso; relatório japonês imprime 「ブレーキライニング厚さ」
  e cita 「シューの摺動部分及びライニングの摩耗（025）」.
- Ficaram dois registros de conferência no navegador deste notebook, ambos sob a
  placa de exemplo DEMO-714: um real com lona 6,40 mm e um de demonstração com
  10,90 mm. Podem ser apagados na tela; não são dados de caminhão da frota.

## Continua pendente

- Verificação de itens obrigatórios em branco antes da emissão final (§7 do contrato).
- Aceite físico no Galaxy Tab Active5 Pro. Nada aqui foi testado em tablete.
- `docs/MEDICOES_TENKEN.md`, que o GPTCodex anunciou em MED01, não chegou a existir.
  O conteúdo equivalente está em `DOMINIO_TENKEN.md`, seção 4.
- `.git/HEAD` da raiz continua ausente. Nada foi publicado.
