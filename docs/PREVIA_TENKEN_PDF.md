# Prévia navegável do Tenken — 10/09/2026

Modelo local criado a pedido de Wagner para conferir a futura interface com as
100 linhas do PDF. Abra `http://127.0.0.1:5174/demo.html#tenken-pdf` ou use
**Abrir modelo de 100 itens** na página inicial da demonstração.

Raiz canônica: `C:\Users\SusumuNotebook-R4\OneDrive - 株式会社ススム (1)\Particular\CODEX\_GPT`.
Para iniciar novamente, execute `scripts/start-tenken-demo.ps1` nessa raiz.

## Recursos para conferência

- Os 100 itens em 10 grupos, na ordem da fonte; busca e filtro de periodicidade.
- Português e japonês em telas separadas, sobre as mesmas respostas.
- Resultado do item separado dos serviços realizados; nenhuma resposta inicial.
- Notas de aplicação originais. O filtro trimestral contém 51 itens e o anual
  contém todos os 100. Os 49 itens brancos são anuais; a nota não define sozinha
  a periodicidade nem dispensa automaticamente uma inspeção.
- Cabeçalho editável de veículo, usuário, oficina, datas, CO e HC.
  O botão de exemplo preenche apenas campos vazios com dados fictícios.
- Observações PT preservadas e versão JA conferida antes da impressão.
- Rascunho salvo no navegador, com proteção contra corrupção, conflito de outra
  aba e erro de gravação; cópia JSON disponível se a gravação falhar.
- Formulário original japonês com os campos e símbolos sobrepostos, botão de
  impressão A4 paisagem, identificação permanente **見本・未確定** e contagem de
  itens sem resposta/a conferir. O PDF original também pode ser aberto.

## Fonte e impressão

Fonte única: `docs/source/tenken-20260910/様式原本_全日本トラック協会_点検整備記録簿 (1).pdf`.
Inventário de 100 linhas: `catalogo_pdf_100_itens.json` na mesma pasta.
SHA-256 do original e da cópia pública `admin-web/public/tenken/original.pdf`:
`a77e1779132759a4a787a217d99dec31929a95ced675a376d73955e974524232`.

A prévia usa uma imagem do original a 220 dpi, com todas as linhas, rótulos,
cores e notas mantidos. Campos e respostas são SVG nas coordenadas em pontos da
página. O logo Susumu aparece na interface; a folha mantém o original. Esta
implementação não é uma edição vetorial do PDF e não certifica uma inspeção.
Datas e números inválidos, texto sem espaço suficiente e observações PT sem JA
conferido bloqueiam a impressão. Resultados sem resposta ou a conferir ficam
sem símbolo de inspeção concluída. Serviços só imprimem se o item foi marcado
como verificado. A opção “não se aplica” é sempre uma escolha manual.

## Isolamento e limites

Código novo: `admin-web/src/demo/pdf-preview/**`.
Versão: `tenken-pdf-20260910-v1`.
Armazenamento: `susumu.tenken.pdf-preview.v1`.

Não altera as 12 linhas ou os registros antigos da demonstração, nem a coleta de
veículos Android/JSON/manual. Ainda não há vínculo desta prévia com a frota,
assinatura, finalização oficial, backend, sincronização ou aplicativo Android.
O salvamento é local a este navegador e computador. A proteção contra outra aba
verifica a versão lida; localStorage não oferece transação atômica entre abas.
O aplicativo oficial Android continua sendo a opção escolhida para ler o NFC do
certificado e exportar JSON. Esta entrega da lista não acrescenta API do MLIT.

## Validação executada

- **199 testes aprovados em 20 arquivos**, incluindo os testes anteriores.
  Novos casos cobrem catálogo, persistência, tradução da tela, filtros,
  separação de ações/resultados, datas, notas e impressão das 100 posições.
- Lint e builds da demonstração e do painel aprovados.
- Chrome: lista completa, filtro trimestral de 51, troca JA/PT, marcação de teste
  e posterior retirada, dados de exemplo, abertura do formulário japonês e
  restauração do rascunho em nova aba.
- Capturas visuais da lista e das partes superior/inferior do formulário
  conferidas. Logo e campos japoneses renderizados corretamente.
- DOM responsivo: larguras de 1006 e 371 px sem transbordamento horizontal da
  página; botões de resposta de 48 e 56 px de altura. Capturas em viewport
  emulado falharam no serviço CUA; a medição DOM passou.
- QA local em `.local/qa-tenken-pdf/`: 22 campos sintéticos sem interseção com
  rótulos da fonte e 100 caixas. Sete símbolos em duas linhas passaram nos
  testes de geometria. Não foi impressa folha física nem validado o tablet.

O teste denso de 100 linhas inicialmente excedeu cinco segundos em execução
concorrente com builds. Consultas DOM repetidas foram reduzidas e aplicado um
limite de 15 segundos somente nesse teste, mantendo todas as asserções.
A suíte completa seguinte passou.

## Coordenação

GPTCodex integrou esta prévia com apoio de subagentes Codex. O domínio/catálogo
reservado a Claude Code permanece intacto. Aviso à sessão interativa
CC-20260910-e4c828be: `GPT-20260910-PDF01-previa.md` em `.local/agent-bridge`
da pasta histórica `TableSusumuSabisu`. Nenhuma nova resposta de Claude chegou
nesta entrega; não houve revisão conjunta deste código.
