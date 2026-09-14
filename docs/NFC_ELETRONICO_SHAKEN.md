# Coleta opcional do certificado eletrônico — 10/09/2026

Wagner pediu implementação de coleta por NFC no Galaxy Tab Active5 Pro Wi-Fi
SM-X350NZGAJ02, mantendo entrada manual. Esclareceu depois que usará o **aplicativo
Android instalado pela Google Play**, com leitura NFC e exportação do arquivo.
**API MLIT não faz parte do fluxo escolhido nem é um requisito.**
Este pedido complementa o formulário Tenken;
não altera a fonte única PDF, as interfaces separadas JA/PT ou a impressão japonesa.

## Incremento implementado no notebook

Na demonstração `http://127.0.0.1:5174/demo.html`, abrir **Coletar dados do caminhão**.

- Entrada manual e importação real do JSON exportado pelo aplicativo oficial.
- Campos: placa, chassi, fabricante, modelo, motor, primeiro registro, validade,
  peso bruto total; número interno e quilometragem atual digitados separadamente.
- Conferência humana obrigatória antes de salvar. Troca de idioma preserva os dados.
- Idiomas `pt-BR` e `ja` separados nesta nova tela. O restante da demo ainda usa
  a interface antiga e depende da integração do catálogo conduzida por Claude.
- Coletas salvas no navegador, reabertas depois de recarregar. Nenhum envio a servidor.
- Reimportação idêntica não duplica; coleta alterada gera outro registro e conserva
  a anterior. Coleta é identificada por UUID próprio, sem se passar por UUID da frota.
- Valores originais japoneses selecionados são preservados junto aos campos editáveis.
  Datas com era são convertidas; primeiro registro conserva precisão de mês.
  Data incompleta ou inválida gera aviso e mantém o original para conferência.
- Arquivo inválido, versão não suportada ou maior que 1 MiB é rejeitado. Falha de
  gravação conserva os campos na tela. Conteúdo local corrompido não é substituído.
- Nenhuma dependência ou configuração foi alterada. Domínio, catálogo, backend,
  Flutter e chave `susumu.tenken.demo.v1` permanecem preservados.

Este incremento é **coleta local conferida**, ainda sem vínculo ao cadastro da frota
ou às inspeções. A opção NFC explica o uso do aplicativo oficial; **não executa
leitura NFC direta**, nem simula sucesso. O fluxo escolhido usa o aplicativo
Android e a importação do arquivo. Ainda não há impressão deste cadastro ou
cálculo automático de vencimentos de manutenção. API está fora deste escopo.

## Hardware e fontes oficiais

A Samsung informa NFC para o SKU exato comprado e descreve a posição frontal do
leitor. Isso confirma o recurso do tablet; o funcionamento do aplicativo MLIT com
um certificado real ainda exige teste físico.
[Samsung — SM-X350NZGAJ02](https://www.samsung.com/jp/tablets/others/galaxy-tab-active5-pro-green-128gb-sm-x350nzgaj02/).

O guia atual do MLIT especifica ISO/IEC 14443 **Type A**, e PC/SC para leitores
Windows. A afirmação Type B do texto enviado não corresponde ao guia atual.
[Guia oficial, página 14](https://www.denshishakensho-portal.mlit.go.jp/assets/files/Overview_and_Preparation_for_the_Vehicle_Inspection_App.pdf).

A consulta do chip pode funcionar offline; a exportação dos arquivos exige
internet. A via disponível agora é aplicativo oficial → leitura física → exportar
JSON → importar nesta tela → conferir → salvar.
[Aplicativo oficial](https://www.denshishakensho-portal.mlit.go.jp/business/application/).

A API inclui veículos kei sujeitos a inspeção desde abril de 2025. O texto que
excluía todos os kei está desatualizado.
[Comunicado do MLIT](https://www.denshishakensho-portal.mlit.go.jp/news/064/).

O Web NFC do Chrome atende NDEF e não oferece as operações de baixo nível ISO-DEP
necessárias para tratar este certificado como uma simples etiqueta web. Não usar
`NDEFReader` ou UID da etiqueta como substitutos da integração MLIT.
[Documentação do Chrome](https://developer.chrome.com/docs/capabilities/nfc).

## Fluxo escolhido: aplicativo Android da Google Play

1. Abrir no tablet o **車検証閲覧アプリ**, instalado pela Google Play.
2. Seguir as instruções do aplicativo para o código impresso e leitura NFC do chip.
3. Com internet, exportar o arquivo **JSON** pelo próprio aplicativo.
4. Em nosso sistema, abrir **Coletar dados do caminhão → Importar arquivo**.
5. Selecionar o JSON, conferir os campos e salvar a coleta; também é possível digitar.

Aplicativo oficial publicado por 国土交通省 物流・自動車局:
[Google Play](https://play.google.com/store/apps/details?id=jp.go.mlit.android.shakenetsuran&hl=ja).
O uso normal do aplicativo e a importação do JSON **não exigem solicitação da API
por nossa empresa**. O código de segurança é informado no aplicativo oficial;
nosso importador não o solicita. O MLIT documenta Android com NFC, incluindo
tablets, e exportação JSON para uso em outros sistemas.
[Aplicativo e exportação oficiais](https://www.denshishakensho-portal.mlit.go.jp/business/application/).

A instalação foi informada por Wagner; execução e leitura física ainda não foram
verificadas pelo Codex. A importação está pronta na demonstração. O vínculo dessas
coletas ao cadastro da frota e às inspeções é integração interna do projeto e
não depende de obter uma API. Entrada manual continua disponível sem NFC/rede.

## Contrato de integração proposto ao Claude Code

Código em `admin-web/src/vehicle-intake/`:

- `capture.ts`: `CaptureDraft`, `VehicleCaptureFields`, `emptyCapture`,
  `parseMlitJson`, `validateCapture` e allowlist dos originais.
- `repository.ts`: `CaptureRecord`, `CaptureStore`, `loadCaptures`, `saveCapture`.
- `VehicleCapture.tsx`, `messages.ts`, `vehicle-capture.css`: interface da coleta.
- Testes de parser, armazenamento e interface; sete fixtures públicas oficiais.

Versão do JSON: `CertInfoImportFileVersion: "1.0"`, objeto `CertInfo`. Não confundir
com a versão 3.34 do documento de especificação. Importar só JSON nesta entrega;
XML, CSV e PDF não são aceitos pelo importador.
[Especificação pública de arquivos](https://www.denshishakensho-portal.mlit.go.jp/assets/files/Vehicle_Inspection_Certificate_Information_Intake_File_Specifications.pdf).

A chave `susumu.vehicle-capture.demo.v1` é independente das inspeções. Não guarda o
arquivo inteiro, nomes/endereço dos proprietários, código de segurança ou chaves
de acesso. Há limite de 1.000 coletas e 10 MiB medidos em UTF-16; o navegador pode
impor quota menor. Detecta mudanças entre leituras de abas, mas localStorage não
oferece transação atômica entre processos: esta prévia deve usar uma aba de escrita.

Claude mantém seus arquivos de domínio reservados. Próximos contratos necessários:

- Autorizar e confirmar vínculo entre coleta e UUID do cadastro da frota; placa ou
  UID NFC isolados não identificam definitivamente um caminhão.
- Conferir divergências por chassi e placa antes de atualizar cadastro existente.
- Preservar snapshot do cabeçalho na inspeção, para alterações de cadastro não
  reescreverem relatórios históricos.
- Persistência/autorização de produção no backend e coleta no aplicativo Android.
- Consumir originais japoneses ou traduções conferidas no formulário final japonês.
- Definir agenda com histórico/regras de inspeção; a validade do certificado não
  preenche automaticamente resultados mecânicos ou todas as datas de Tenken.

O aviso e a entrega ao Claude Code usam o canal compartilhado da sessão
CC-20260910-e4c828be, na pasta documental antiga `.local/agent-bridge/`.
Não há confirmação de leitura desta rodada NFC até o momento deste registro.

## Validação

Executado na raiz `admin-web` em 10/09/2026:

- `npm test`: **157 testes aprovados**, em 16 arquivos; 85 novos testes de coleta
  (60 adaptador, 15 armazenamento, 10 interface). Inclui dados oficiais de teste.
- `npm run lint`: aprovado, sem erros ou avisos.
- `npm run build:demo`: aprovado, incluindo TypeScript; gerado `dist-demo`.
- Chrome: aberta a entrada da coleta, conferidos controles e conteúdo acessível
  em português e japonês, alternância de idiomas e explicação do NFC. Aba deixada
  aberta em português. A captura de imagem do navegador expirou; não declarar
  conferência visual por screenshot nem validação física do tablet.
- Revisão somente leitura de auxiliar Codex encontrou dois pontos corrigidos:
  preservação na exibição de ano/mês quando falta era, e status explícito de
  integração direta ainda não implementada. Não foi revisão do Claude Code.

Uma execução anterior detectou um teste de tamanho lento por construir repetidamente
megabytes de JSON; o fixture passou a ser construído uma vez, mantendo a verificação
do limite. O lint identificou nome de função que parecia hook; renomeado. A execução
final completa acima passou após as correções.

O teste físico do tablet, vínculo à frota, migração do catálogo e impressão no PDF
não foram executados por este incremento. API não integra o fluxo escolhido. Não houve publicação
ou commit: o `.git/HEAD` canônico ainda não foi recuperado neste notebook.
