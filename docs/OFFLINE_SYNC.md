# Offline e sincronização

Decisão: [ADR-002](../decisions/ADR-002-offline-first.md). A revisão dedicada foi feita no contrato inicial e continua na revisão adversarial da implementação.

## Estados

1. Rascunho local: dados persistidos no SQLite, ainda sujeitos a edição.
2. Operação pendente: payload e UUID registrados na mesma transação do agregado.
3. Enviando: conteúdo congelado; timeout/retry conserva UUID e bytes lógicos.
4. Confirmado: servidor retorna ID/versão consistentes, fila avança e preserva histórico local.
5. Conflito/erro permanente: envio daquela inspeção interrompido e trabalho preservado; outras inspeções e anexos já declarados continuam.
6. Finalizado com fotos pendentes: respostas imutáveis, bytes declarados ainda sendo enviados.
7. Completo no servidor: respostas e anexos verificados disponíveis no histórico.

Cliente coalesce somente operação nunca tentada. Não substituir conteúdo de uma operação que pode ter sido aceita pelo servidor antes de perder a resposta. Fila é serial; versões previstas encadeiam operações do mesmo agregado. O servidor incrementa versão uma vez por nova operação aceita; repetição exata retorna a versão original.

Uma operação bloqueada nunca libera operações posteriores da mesma inspeção. Ela também não bloqueia inspeções independentes. A tela da fila informa a causa e permite criar explicitamente uma cópia para revisão: novo UUID, origem selada preservada, payload tentado intacto, fotos copiadas com novos IDs, assinatura limpa e vínculo de procedência. O operador deve conferir o histórico antes de finalizar a cópia, pois a origem pode existir no servidor. Isso não é um aceite do servidor nem uma correção automática de um registro finalizado.

Inspeções pertencem ao usuário, dispositivo e servidor de origem. Sair da conta não apaga pendências; entrar com outra conta não entrega acesso ao trabalho anterior. Ao expirar token, renovar autenticação antes de enviar. Nenhuma falha de rede autoriza remover dados locais.

Uma mudança de servidor/conta não transfere dados automaticamente. O aplicativo mostra um aviso genérico quando existem registros preservados de outra sessão, sem revelar nomes, veículos ou conteúdo dessa sessão. Teclas já autorizadas antes da revogação podem concluir seu salvamento no proprietário original; novas edições ficam bloqueadas.

## Fotos

Arquivos originais locais precedem referência confirmada na inspeção. Anotação usa novo arquivo. Upload pode ser repetido com checksum; falha preserva o original. Finalização congela os IDs declarados, mas não oculta pendências de upload. Capacidade insuficiente precisa ser mostrada; o aplicativo não pode anunciar que salvou quando o sistema de arquivos rejeitou a gravação.

Falha em uma foto é registrada individualmente e não interrompe anexos independentes. O recibo de sincronização confirma quais IDs já foram declarados; somente esses anexos podem iniciar upload. Assinaturas usam a mesma declaração pendente e jamais são anexadas com um ID novo depois da finalização.

A câmera utiliza um único diário de captura e um bloqueio compartilhado, porque o retorno de Activity do Android é global ao aplicativo. Antes de outra conta fotografar, um retorno anterior é preservado no proprietário original, sem entregar seus bytes ou detalhes à conta atual. Falha de gravação mantém o diário para recuperação. Arquivo temporário definitivamente perdido exige aviso explícito e nova captura; não pode bloquear para sempre a câmera. A aceitação física ainda deve exercitar destruição de Activity e pressão real de armazenamento.

## Cenários de falha

Testar salvar e reabrir; finalizar e reiniciar; interromper o app antes/depois do commit SQLite; resposta perdida após commit no servidor; reenvio com payload modificado; falha entre agregado/recibo/auditoria; upload parcial; servidor indisponível;401/403/409/429; dois usuários no mesmo tablet; dois tablets no mesmo veículo; armazenamento cheio e tempo offline prolongado.

O banco local não garante recuperação contra perda física do aparelho antes do primeiro sync. A oficina precisa de um procedimento alternativo durante reparo ou indisponibilidade do único tablet.
