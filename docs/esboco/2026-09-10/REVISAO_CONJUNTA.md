# Revisão conjunta do esboço — Codex e Claude Code

Data: 10/09/2026. Escopo autorizado: somente documentação, desenho e cenários de testes/subtestes. Um tablet comprado, ainda aguardando entrega. A programação anterior foi preservada; esta rodada não altera o aplicativo.

## Resultado acordado

**Pronto para revisão de Wagner; programação não autorizada; 91 subtestes não executados.** Este consenso avalia a qualidade e a consistência do desenho. Não é aceite do negócio, execução de testes, certificação mecânica, homologação do tablet ou autorização de produção.

Materiais finais: [esboço completo](ESBOCO_COMPLETO.md), com dez telas do tablet e fluxo do painel; [matriz](TESTES_E_SUBTESTES.md), com 21 famílias e 91 IDs de subtestes. As decisões D01–D13 permanecem propostas/questões a confirmar na etapa correspondente.

## Como ocorreu a colaboração

Claude Code real foi chamado pela CLI autenticada, na sessão `9cc4c49e-ffb9-4d57-a5a5-e8348a0b712c`, com ferramentas restritas a Read/Grep/Glob. Não foi um agente Codex apresentado como Claude. Houve uma proposta inicial, revisão do esboço e conferência final das alterações. Codex consolidou os documentos e realizou uma revisão documental adicional com outro agente Codex, sem atribuir a ele a identidade de Claude.

A leitura de requisitos, conferência de referências/IDs e inspeção dos nomes de arquivos alterados são verificações documentais. Nenhum teste do aplicativo, backend, banco, build ou migration foi executado para este esboço. Resultados históricos da V1 não foram usados para preencher a matriz nova.

## Discussões e decisões do desenho

| Tema | Decisão desta rodada |
|---|---|
| Um tablet | Manter apenas a unidade comprada. Troca de usuário não exige segunda compra; teste físico entre dois tablets fica fora do piloto |
| Crítico | Prever encaminhamento humano e registro controlado; não inventar liberação automática, tela existente ou módulo de ordem de serviço |
| Papéis e assinatura | Definir responsabilidades e de quem colher assinatura com a oficina; não transformar o contrato anterior em aprovação empresarial |
| Prazo offline | Tratar 72 horas como referência técnica proposta, dependente de D04, sem nova regra empresarial presumida |
| Metas numéricas | Sugestões iniciais de porcentagem de sincronização, bloqueios por semana, minutos por check-in e horas de bateria não foram adotadas. Dependem de condições e objetivos aprovados; nenhuma porcentagem dispensa testes de integridade ou acesso |
| Amostra do piloto | Vinte inspeções sintéticas em cinco dias são apenas proposta D13, sem prova estatística de confiabilidade |
| Limite de perda física | Preservação nas falhas operacionais cobertas; dados nunca enviados não podem ser recuperados do servidor após perda definitiva do tablet |
| Recuperação | Objetivos e procedimento do ensaio antes de T18; retenção definitiva antes de produção |
| Resultados dos testes | Decisão de negócio ausente implica Bloqueado; variações dentro de um subteste exigem evidência própria |
| Salvamento | Especificar eventos que solicitam gravação e distinguir alteração ainda não confirmada da última versão confirmada |
| Evolução | Acrescentar T21: estrutura versionada, atualização preservando dados, fila pendente, falha/recuperação e compatibilidade, somente como cenários |

Claude encontrou cinco lacunas de redação/pré-condições (G1–G5); todas foram corrigidas. A revisão adicional encontrou três ajustes de objetivos de restauração, âmbito da garantia e evidência por variação; também foram incorporados. A observação final sobre contas versus pessoas foi harmonizada na introdução da matriz depois do parecer abaixo; trata-se de redação, sem nova regra.

## Parecer final de Claude Code — transcrição

O texto a seguir é a revisão de documentos, com os limites declarados pelo próprio revisor. Referências a linhas são as posições observadas naquele momento e podem mudar com edições de Markdown.

# Verdicto documental — delta final

Li apenas o que foi pedido: `ESBOCO_COMPLETO.md` §8, §10, §11, §12 e, na matriz, a introdução e T21. **Nada foi executado**: sem código, build, migração, serviço, banco ou CI.

## Conferência das cinco lacunas

**G1 — resolvida.** T05.3 (linha 73) e T09.5 (linha 120) passaram a trazer “Enquanto D06/D05 aberta, subteste Bloqueado”, alinhando-se a T06.4 e T09.2. Melhor ainda, a introdução (linha 17) criou a regra geral: decisão D01–D13 aberta ou pré-condição ausente ⇒ **Bloqueado**, sem escolher resultado de negócio por suposição. Isso cobre casos futuros que eu não enumerei.

**G2 — resolvida.** §8 regra 1 (linha 194) nomeia os eventos que solicitam gravação — escolher status, editar texto/número, incluir anexo — e afirma explicitamente que o desenho **não** depende de sair do campo ou trocar de seção. Mantém a marcação visível do não confirmado, inclusive número parcial, e amarra T08.2 à última versão confirmada. A fronteira “salvo × não salvo” agora tem referência de comportamento pretendido, não só observação.

**G3 — resolvida.** D01 (linha 229) separa corretamente o que eu pedi: **duas contas individuais** para o isolamento técnico (T02.2/T09.4/T10.3) e **duas pessoas identificadas** para validar a troca de turno; sem isso, Bloqueados.

**G4 — resolvida.** §11 (linha 257) usa “Não executado ou Bloqueado”, coerente com os quatro estados da matriz (linha 15).

**G5 — resolvida.** §11 (linha 253) liga T20, D13 e T20.3, mantendo a amostra como proposta; §12 (linha 263) referencia a matriz de 21 famílias/91 subtestes e T21.

## Correções independentes verificadas

D11 (linha 239) agora exige procedimento e objetivos mensuráveis **antes de T18**, deixando política definitiva de retenção para antes da produção — o ensaio deixa de depender de meta inexistente. §11 (linha 251) delimita honestamente o “zero perda”: alterações confirmadas nas falhas de operação e retomada cobertas, com T18.4 tratando à parte o limite da perda física de dados nunca enviados, sem prometer recuperá-los do servidor; isso não conflita com §8 regra 10. A introdução (linha 19) passou a exigir evidência **variação por variação** em linhas compostas, com o ID só aprovado quando todas passarem, e diz expressamente que os 91 IDs não são contagem executada.

## T21 e contagem

Recontei: 86 anteriores + 5 de T21 = **91 IDs únicos em 21 famílias**, coerente com as linhas 9, 275 e §12. T21 permanece **planejamento**: a pré-condição (linha 249) proíbe executar migrations, instalar versão nova ou criar teste automatizado nesta fase, e os cinco casos descrevem expectativa — estrutura versionada, preservação de dados existentes, atualização com rascunho/fila pendente, interrupção e recuperação em ambiente descartável, e cliente antigo com servidor atualizado. Não introduz métrica numérica nova. Está referenciada em §12 e nas camadas futuras (linhas 266 e 269), com D11/D12 associadas.

**Nenhum bloqueador novo.** Ajuste opcional, não bloqueante: a linha 5 da matriz ainda diz “conta A e conta B representam pessoas distintas”, enquanto D01 agora distingue duas contas de duas pessoas; harmonizar a frase evitaria leitura ambígua.

## Limites desta revisão

Li somente as seções indicadas; não revalidei as demais famílias nem a implementação existente. Não executei nem observei nenhum teste, build ou CI — **nenhum dos 91 subtestes tem resultado**. Não há aceitação de negócio (D01–D13 seguem abertas) nem de hardware (o Galaxy ainda não chegou; caneta, luva, câmera, bateria e espaço permanecem hipóteses). Não verifiquei branches, workflows ou estado remoto. A V1 existente segue intocada.

**pronto para revisão de Wagner; programação não autorizada; 91 subtestes não executados**

## Continuidade

O próximo passo é a revisão de Wagner das telas, fluxo e decisões D01–D13. A programação só pode recomeçar mediante nova instrução explícita. A execução futura dos testes exige suas pré-condições e, no caso físico, a chegada do tablet. Publicação desta documentação em branch própria não equivale a implantação ou novo aceite da V1.

