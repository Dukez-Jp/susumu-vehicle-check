# Correções encontradas no primeiro CI Linux

O primeiro run do PR #1, [34367724548](https://github.com/Dukez-Jp/susumu-vehicle-check/actions/runs/34367724548), passou o painel e encontrou duas falhas de concorrência no backend e uma diferença de preparação de teste no Android. O merge foi suspenso para corrigir e verificar esses casos.

## Replay após commit concorrente

O primeiro lookup de recibo podia retornar vazio, outra requisição concluir e a consulta seguinte encontrar uma inspeção já criada, atualizada ou finalizada. `AuthorizeUpdate` então retornava 409 antes de alcançar os handlers de conflito de `SaveChangesAsync`. Os testes probabilísticos tinham passado no Windows; o CI expôs a janela.

`SyncReceiptRaceTests` usa um interceptor antes de abrir a transação, depois do lookup vazio. O teste aguarda o commit concorrente e só depois libera o pedido suspenso. Antes da correção, os três casos positivos falharam deterministicamente no SQLite e o caso PostgreSQL também falhou. Os casos negativos já eram rejeitados.

`InspectionSyncService.ApplyAsync` agora trata o 409 no limite externo da tentativa, depois que sua transação foi descartada, e consulta novamente o recibo persistido. O mesmo `Replay` continua exigindo ator, dispositivo e hash canônico idênticos. Sem recibo correspondente, o conflito original permanece. Não há novas escritas nesse caminho.

Os sete cenários são executados no SQLite e em um teste PostgreSQL: criação, atualização e finalização retornam exatamente a resposta aceita; payload, dispositivo, usuário ou operação diferentes continuam rejeitados. Também se verifica ausência de transação pendente, incremento indevido de versão ou auditoria duplicada.

## Preparação portátil da falha de gravação de foto

O teste criava um arquivo no lugar da raiz do armazenamento antes de procurar uma foto já preservada. Linux retorna `ENOTDIR` nessa consulta, enquanto Windows retorna caminho não encontrado. Parar diante de `ENOTDIR` é o comportamento conservador correto do aplicativo; tratá-lo como origem ausente poderia ocultar um problema real de armazenamento.

Somente `camera_test.dart` mudou. Agora o bloqueador é criado na leitura da segunda origem, depois das consultas de recuperação. O arquivo realmente ausente é registrado primeiro, e a falha ocorre na gravação pretendida. As verificações de índice, UUID e diagnóstico foram mantidas; verificações adicionais provam que o caminho ausente não é lido novamente e os caminhos originais são preservados. Produto e APK permanecem inalterados. Os 8 testes de câmera e os 63 testes completos passaram localmente, com análise e formatação limpas.

## CI e evidência final

O workflow continua executando os quatro jobs no PR e novamente em `main`, além de execução manual. O trigger duplicado de push em branch de feature foi removido para evitar duas execuções completas do mesmo PR.

Este registro descreve a causa e a correção. O resultado Linux do commit corrigido deve ser consultado no [PR #1](https://github.com/Dukez-Jp/susumu-vehicle-check/pull/1); a primeira execução com falhas não é evidência de conclusão. O coordenador só integra a entrega depois de observar os quatro jobs aprovados.
