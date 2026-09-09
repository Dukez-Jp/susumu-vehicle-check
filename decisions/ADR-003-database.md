# ADR-003 — Dados centrais e histórico

Data: 2026-09-09. Decisão: adotada.

PostgreSQL18 é o motor central. Migrations EF Core versionadas definem schema e índices. Dados de demonstração, incluindo o veículo714, entram por seed idempotente explicitamente DEV, separado das migrations de produção.

Todas as consultas operacionais exigem autenticação e escopo de empresa/unidade. IDs recebidos não dão permissão de acesso. O servidor deriva ator e escopo da conta autenticada. Papéis iniciais de implementação: Administrator, Supervisor, Inspector e Office. O papel Mecânico do prompt está coberto inicialmente pelo perfil Inspector; criar um perfil separado exige definir permissões distintas.

Checklists publicados são versões imutáveis. Inspeções guardam template e versão usados; mudanças posteriores não reescrevem o histórico. Recibos de operações e auditoria persistem no banco, não em memória de processo.

Rotinas de backup incluem banco e armazenamento de fotos. Restauração deve ser ensaiada em um banco novo, com contagens e checksums conferidos. Não considerar apenas sucesso do comando de backup como evidência de recuperação.
