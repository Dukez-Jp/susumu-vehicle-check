# ADR-002 — Durabilidade, sincronização e inspeções independentes

Data: 2026-09-09. Decisão: baseline de implementação derivado da revisão Codex/Claude; comportamento efetivo será confrontado com os testes de integração.

Um registro só pode aparecer como salvo após a transação SQLite terminar. A transação grava agregado e operação pendente conjuntamente. Cada inspeção tem UUID gerado no cliente, usuário e dispositivo responsáveis. Cada operação possui UUID e payload congelado ao primeiro envio; reenvio conserva a mesma identidade e conteúdo.

Servidor grava inspeção, recibo de idempotência e auditoria na mesma transação. Repetição exata retorna o recibo anterior. Reutilização de identidade com payload diferente retorna409. Cada nova operação aceita incrementa a versão em exatamente1; retry não incrementa. Alteração exige a versão esperada; conflito nunca usa sobrescrita silenciosa.

No V1, dois dispositivos podem criar inspeções independentes sobre o mesmo veículo. Eles não editam conjuntamente a mesma inspeção. Essa escolha permite começar com uma unidade e evita um bloqueio global impossível de garantir sem conexão. A identificação do veículo não é uma chave de idempotência.

Finalização torna a inspeção imutável. Correção cria outra inspeção ligada ao registro original, com motivo. Uploads de fotos já declaradas podem terminar posteriormente; o servidor deve distinguir finalizado com anexos pendentes de pacote completo.

Sessão offline de rascunhos tem limite inicial de72 horas desde autenticação online. Sincronização exige autenticação online válida. Revogação não pode ser conhecida por um aparelho desconectado; esse limite deve ser validado no piloto. Dados locais pendentes pertencem ao usuário/servidor que os criou e não podem ser exibidos ou enviados por outra conta.

Antes de produção, testar reinício real, armazenamento cheio, rede intermitente, relógio alterado, login expirado e usuário revogado. Não prometer proteção contra destruição física do único tablet antes da sincronização: é necessário procedimento operacional alternativo e backup do servidor.
