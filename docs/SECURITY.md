# Segurança

## Controles esperados e revisão

| Risco | Controle | Verificação necessária |
| --- | --- | --- |
| Acesso a outra empresa/unidade | Escopo derivado da identidade em cada endpoint | Testes de IDs de outro escopo |
| Elevação de privilégio | Papéis e conta ativa verificados no servidor | Inspector/Office rejeitados em ações administrativas |
| Senha exposta | Hash de senha com salt; segredo de assinatura por ambiente | Scanner de fonte e teste de configuração |
| Token roubado no navegador | Token em memória, sem URL/localStorage | Testes de login/logout e revisão do cliente |
| Dispositivo desconectado | Sessão limitada, partição por usuário/servidor, bloqueio do aparelho | Expiração, logout e troca de conta |
| Sobrescrita/retry | Transação, hash de payload e versão esperada | Reenvio igual/diferente e conflito |
| Upload malicioso | Tipo real, assinatura, tamanho, checksum, caminho por ID, autorização | Bytes inválidos, caminho, escopo, substituição |
| Histórico alterado | Finalização/versionamento/auditoria | Tentativas de editar o finalizado |
| CSV executável | Escapar aspas, quebras e fórmulas | Campos começando por =,+,-,@ |

## Operação

Produção exige HTTPS válido, backup protegido, acesso restrito ao host/banco, contas pessoais por funcionário e revisão de privilégios. Configuração MDM/kiosk deve ocorrer após validação do aplicativo. Não compartilhar credenciais administrativas entre mecânicos.

Não incluir `.env`, tokens, chaves de assinatura, senhas, dumps ou fotos reais em Git/PR/logs. Variáveis de desenvolvimento são geradas localmente; fixtures sintéticas não devem habilitar credenciais padrão em produção. `Production` deve falhar ao iniciar sem configuração segura necessária.

A revogação não chega a um tablet sem conexão. O prazo offline inicial de72 horas permite rascunhos; sincronização requer autenticação válida. Ajustar esse prazo e o procedimento de perda/roubo do aparelho antes de produção. Relógio adulterado, extração física de dados e proteção do dispositivo exigem testes e gestão operacional; não afirmar garantias de MDM sem implantação.

Esta documentação descreve os controles a validar. Evidências efetivas e limitações residuais constam do relatório de entrega; revisão de código não substitui um teste de intrusão independente.
