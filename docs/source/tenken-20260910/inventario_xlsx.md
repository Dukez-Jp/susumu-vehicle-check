# Inventário da planilha de inspeção japonesa

Fonte: `Formulario_Inspecao_Original_JP.xlsx`. Leitura de todas as células via XML interno do XLSX. SHA-256: `911fe6962dde91b8f7ac4d942be1e935a08ce692727feba10b6addee6c6d0384`.

## Resultado conferido

- 2 abas visíveis: `事業用 (青)` e `自家用・その他 (緑)`, ambas `A1:L28`.
- 35 linhas distintas de inspeção, repetidas integralmente nas duas abas (70 ocorrências).
- 8 seções, 6 campos de cabeçalho, 6 linhas de peças/trocas, 1 campo de orientações e 8 símbolos de legenda.
- 59 células com conteúdo por aba. Todas classificadas neste inventário. Nenhuma periodicidade está escrita na planilha.

Título A1, idêntico nas duas abas: `事業用等点検整備記録簿 (特定整備記録簿写)`.

As referências de células abaixo valem para as duas abas. Textos japoneses preservados literalmente.

## Seções e itens

| Seção original | Quantidade de linhas | Célula do título |
| --- | ---: | --- |
| ■ステアリング装置 | 5 | A12 |
| ■ブレーキ装置 | 8 | A19 |
| ■走行装置 | 5 | D12 |
| ■サスペンション | 3 | D19 |
| ■動力伝達装置 | 4 | D24 |
| ■電気装置 | 2 | G12 |
| ■エンジン | 6 | G16 |
| ■発散防止装置 | 2 | G24 |

| ID do inventário | Célula | Texto japonês exato | Campo de resultado |
| --- | --- | --- | --- |
| xlsx-steering-01 | B13 | ハンドルの操作具合/遊び、がた | A13 |
| xlsx-steering-02 | B14 | ステアリング・ギヤ・ボックスの油漏れ | A14 |
| xlsx-steering-03 | B15 | ロッド、アーム類の緩み、がた、損傷 | A15 |
| xlsx-steering-04 | B16 | ホイール・アライメント | A16 |
| xlsx-steering-05 | B17 | パワー・ステアリング・ベルトの緩み | A17 |
| xlsx-brakes-01 | B20 | ブレーキ・ペダルの遊び | A20 |
| xlsx-brakes-02 | B21 | ブレーキの効き具合 | A21 |
| xlsx-brakes-03 | B22 | パーキング・ブレーキの引きしろ | A22 |
| xlsx-brakes-04 | B23 | ホース、パイプの漏れ、損傷 | A23 |
| xlsx-brakes-05 | B24 | ブレーキ・マスタ・シリンダの機能 | A24 |
| xlsx-brakes-06 | B25 | ブレーキ・ドラムとライニングのすき間 | A25 |
| xlsx-brakes-07 | B26 | ブレーキ・パッドの摩耗 | A26 |
| xlsx-brakes-08 | B27 | ブレーキ・ディスクの摩耗、損傷 | A27 |
| xlsx-running-01 | E13 | タイヤの空気圧 / 亀裂、損傷 | D13 |
| xlsx-running-02 | E14 | タイヤの溝の深さ、異常摩耗 | D14 |
| xlsx-running-03 | E15 | ホイール・ナット、ボルトの緩み | D15 |
| xlsx-running-04 | E16 | フロント・ホイール・ベアリングのがた | D16 |
| xlsx-running-05 | E17 | リヤ・ホイール・ベアリングのがた | D17 |
| xlsx-suspension-01 | E20 | リーフ・スプリングの損傷 | D20 |
| xlsx-suspension-02 | E21 | ショック・アブソーバの損傷、油漏れ | D21 |
| xlsx-suspension-03 | E22 | エア・サスペンションのエア漏れ | D22 |
| xlsx-power_transmission-01 | E25 | クラッチ・ペダルの遊び | D25 |
| xlsx-power_transmission-02 | E26 | トランスミッションの油漏れ、油量 | D26 |
| xlsx-power_transmission-03 | E27 | プロペラ・シャフトの連結部の緩み | D27 |
| xlsx-power_transmission-04 | E28 | デファレンシャルの油漏れ | D28 |
| xlsx-electrical-01 | H13 | バッテリのターミナル部の緩み | G13 |
| xlsx-electrical-02 | H14 | 電気配線の接続部の緩み、損傷 | G14 |
| xlsx-engine-01 | H17 | 低速、加速の状態 | G17 |
| xlsx-engine-02 | H18 | 排気ガスの色 (CO, HC) | G18 |
| xlsx-engine-03 | H19 | エア・クリーナ・エレメントの汚れ | G19 |
| xlsx-engine-04 | H20 | エンジン・オイルの漏れ | G20 |
| xlsx-engine-05 | H21 | ファン・ベルトの緩み、損傷 | G21 |
| xlsx-engine-06 | H22 | 冷却水の漏れ | G22 |
| xlsx-emissions-01 | H25 | メターリング・バルブの状態 | G25 |
| xlsx-emissions-02 | H26 | DPF/SCR 触媒の機能 | G26 |

Cada linha da tabela é uma descrição de inspeção com uma caixa de resultado. Descrições com múltiplas verificações permanecem agrupadas como na fonte. Os IDs são somente do inventário; ainda não são IDs do catálogo do aplicativo.

## Campos e peças

| Rótulo original | Célula | Entrada vazia |
| --- | --- | --- |
| 依頼者 (使用者) | A3 | A5:D5 |
| 自動車登録番号 (ナンバープレート) | E3 | E5:H5 |
| 車台番号 | I3 | I5:L5 |
| 点検年月日 | A7 | A8:D8 |
| 整備完了年月日 | E7 | E8:H8 |
| 整備主任者の氏名 | I7 | I8:L8 |

Seção `交換部品等` em J12; as linhas abaixo são peças/trocas, sem unidade ou quantidade predefinida.

| Texto original | Célula | Entrada vazia |
| --- | --- | --- |
| エンジンオイル | J13 | L13 |
| オイル・フィルタ | J14 | L14 |
| LLC (クーラント) | J15 | L15 |
| ブレーキ・フルード | J16 | L16 |
| エア・エレメント | J17 | L17 |
| ワイパーゴム | J18 | L18 |

`メンテナンスに関するアドバイス` em J20, com campo livre mesclado `J21:L26`.

## Legenda original (A10)

| Símbolo | Significado japonês |
| --- | --- |
| ✔ | 良好 |
| X | 交換 |
| A | 調整 |
| C | 清掃 |
| O | 修理 |
| T | 締付 |
| L | 給油 |
| D | 分解 |

Não há símbolo explícito para defeito pendente, não inspecionado ou não aplicável. A correspondência com o PDF e com estados do aplicativo precisa ser reconciliada.

## Impressão e limites

- As duas abas têm 31 intervalos mesclados, dimensões e textos iguais; mudam os nomes e as cores de preenchimento azul/verde.
- Sem área de impressão, títulos de impressão, tamanho de papel, orientação, escala, ajuste para páginas ou quebras manuais definidos. Apenas margens de 0,75 pol. laterais, 1 pol. superior/inferior e 0,5 pol. cabeçalho/rodapé.
- Altura padrão de linha: 15 pontos. A aparência impressa ainda não foi validada em aplicativo nativo. O arquivo sozinho não comprova reprodução do formulário PDF original.
- A segunda aba tem nome de uso privado/outros, porém repete o título de uso comercial. Não assumir que represente uma tabela de inspeção diferente.
- Nenhuma periodicidade, condição de aplicabilidade ou limite de quilometragem consta no XLSX. Não inferir intervalos a partir da cor ou do nome de aba.
- Não há fórmulas, imagens, PDF incorporado, macros, gráficos, comentários, validações de entrada ou links externos no pacote.
- Fonte preservada: extração somente leitura; hash conferido antes e depois.

O JSON contém todas as células, inclusive vazias armazenadas, estilos, mesclagens, referências e metadados de impressão para auditoria.
