# Estudo: vídeo KTC "e-整備" (TRASAS) e o que aproveitar no Tenken

Data: 10/09/2026. Autor: Claude Code. Pedido de Wagner: "estude este vídeo para melhorarmos nosso app".
Vídeo: https://www.youtube.com/watch?v=lmBkYPsvot0 — 「#自動車整備」印刷可能な点検記録簿アプリ「e-整備」, canal KTC Kyoto Tool, 2 min, legenda automática em japonês.

## O que o vídeo diz (transcrição resumida)

1. Mesmo com ferramentas precisas, o registro falha em três situações: 手書きで記載 (escrito à mão), レ点チェックだけ (só um tique, sem valor), 記録を残していない (sem registro). Qualquer uma delas "pode perder a confiança do cliente".
2. Digitalizar não basta se o mecânico escreve no papel e depois alguém digita no PC: aumenta carga, gera 転記ミス (erro de transcrição) e 入力ミス, e "nunca fica eficiente".
3. Os medidores TRASAS (タイヤデプスゲージ, ブレーキパッドゲージ) enviam a medição por Bluetooth ao app no tablet; a entrada é automática.
4. Resultado prometido: sem 記入漏れ (campo esquecido) nem 記入間違い, histórico acumulado, トレーサビリティ como valor novo para o cliente.

## O que o app e-整備 faz (fontes: ktc.jp, iPROS, Response.jp, APPLION)

- Gera e imprime, direto do tablet, os 点検記録簿 oficiais: 日常点検, 足回り, 12ヶ月, 24ヶ月, タイヤ残量, ブレーキ残量, ホイールナット締付.
- Os formulários de 12/24 meses existem em três layouts regionais: 関東・中部・関西.
- Lê o QR do 車検証 para preencher os dados do veículo.
- Recebe medições por Bluetooth (profundidade de pneu, espessura de pastilha, torque da chave トルクル), com alerta de porca esquecida ou aperto insuficiente.
- Busca de histórico por veículo.
- Grátis com planos pagos (スタンダード / プロ); 12/24 meses e QR são pagos.
- Sinal de produto parado: versão Android 1.0.0 de setembro de 2019, iOS 11–12, Android 5–9.

Preços dos medidores (varejo, set/2026): タイヤデプスゲージ GNDA020 ≈ ¥24.000–33.000; ブレーキパッドゲージ GNNA025 ≈ ¥28.000–31.000 (lista ¥45.210).

## Comparação com o Tenken

| Ponto | e-整備 | Tenken (decisões de Wagner) |
| --- | --- | --- |
| Formulário | Vários 記録簿 oficiais, 3 variantes regionais | Só o PDF 全日本トラック協会, 100 linhas |
| Idioma | Só japonês | Tela JA ou PT-BR; impressão sempre JA |
| Público | Oficinas que atendem clientes | Frota própria da ススム, mecânicos brasileiros e japoneses |
| Medições | Automáticas via Bluetooth (ferramentas KTC) | Digitadas |
| Dados do veículo | QR do 車検証 | Cadastro de veículos da demo |
| Offline / vários tablets | Não documentado | Requisito central |
| Manutenção do produto | Parado desde 2019 | Em desenvolvimento |

Conclusão: e-整備 não substitui o Tenken (sem português, sem o formulário da 全ト協, sem sincronização, produto parado). Mas ele valida a tese do projeto: imprimir o formulário oficial a partir do tablet, sem redigitação, é exatamente o que o mercado japonês vende como "confiança do cliente".

## Melhorias propostas, em ordem de custo-benefício

1. **Campos de medição tipados no catálogo** (barato agora, caro depois). Toda linha do PDF que pede número (溝の深さ, パッド厚, CO %, HC ppm, quilometragem) vira campo numérico com unidade, faixa aceitável e origem (`manual` | `dispositivo`). Separa "valor medido" de "resultado" (símbolo ✓ / × / 交換 do PDF). Isso deixa a porta aberta para medidores Bluetooth sem redesenhar o modelo. Responsável: Claude Code (domínio/catálogo).
2. **Bloqueio de 記入漏れ antes de imprimir.** O app já começa com nenhum item aprovado; falta a verificação de completude que lista as linhas obrigatórias vazias no idioma da tela e impede a emissão final. Responsável: Codex (interface), regra definida por Claude Code (domínio).
3. **Leitura do QR do 車検証 para o cabeçalho** (登録番号, 車台番号, 型式, 初度登録年月). O Tab Active5 Pro tem câmera; elimina digitação de dados que mudam pouco e erram muito. Precisa confirmar o formato do QR do 車検証 (papel) e do 電子車検証 (IC) antes de prometer. Fase posterior; Codex.
4. **Histórico por veículo com tendência das medições** (pneu e pastilha ao longo do tempo). Só faz sentido depois do item 1. Fase posterior.
5. **Registro de aperto de porcas de roda (ホイールナット).** Para caminhões é item de segurança com campanha do 国交省 contra 脱輪. Não está nas 100 linhas do PDF como registro de torque; anotar como pedido futuro, não para V1.
6. **Medidores Bluetooth TRASAS.** Não comprar agora: ≈¥55.000 pelos dois, e o benefício aparece só com o item 1 pronto e o piloto físico validado. Reavaliar após o piloto.

## O que NÃO muda

- PDF como fonte única e impressão só em japonês continuam. As variantes regionais 関東/中部/関西 são dos 12/24ヶ月 de veículos de passeio; não se aplicam ao formulário da 全ト協 que Wagner escolheu.
- Excel segue como histórico.
