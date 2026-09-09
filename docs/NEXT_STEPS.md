# Continuidade — SUSUMU VEHICLE CHECK

Atualizado durante a implementação de 2026-09-09. A fonte de verdade é o checkout `C:\Users\Pc Forex 2025\OneDrive - 株式会社ススム\Particular\CODEX\_GPT` e o [repositório privado](https://github.com/Dukez-Jp/susumu-vehicle-check). O projeto foi transferido integralmente para este novo diretório do OneDrive por solicitação de Wagner; veja MUDANCA_ONEDRIVE.md.

## O que já foi construído

Aplicativo Android Flutter/Drift, API .NET10/PostgreSQL18, painel React, documentação, ferramentas de desenvolvimento, backup/restore e workflow de CI. O estado de validação de cada requisito está em [COBERTURA_V1](COBERTURA_V1.md); evidência final deve prevalecer sobre contagens intermediárias das revisões.

O Claude Code real participou da implementação do backend e das revisões, por sessões autenticadas da CLI. Codex integrou os componentes, revisou integridade/contratos e coordenou as correções. Os históricos dessas execuções não significam que as interfaces compartilham automaticamente a mesma conversa.

## Abrir e avaliar

Siga [PRIMEIRO_USO](PRIMEIRO_USO.md). No PowerShell, execute `C:\Users\Pc Forex 2025\OneDrive - 株式会社ススム\Particular\CODEX\_GPT\scripts\start-local.ps1`; acesse o painel em `http://127.0.0.1:5173`. Credenciais DEV são consultadas somente no arquivo local indicado pelo guia. O APK está em `mobile\build\app\outputs\flutter-apk\app-debug.apk` após o build; é uma distribuição de avaliação.

## O que depende da chegada do tablet

Wagner comprou uma unidade Samsung Galaxy Tab Active5 Pro Wi-Fi e aguarda entrega. Confira SKU, câmera, S Pen, permissões, orientação, luvas e ergonomia; execute a lista de testes físicos do guia. A sessão offline, retomada após reinício e sincronização precisam passar também no aparelho real.

Os serviços Windows atuais escutam somente em loopback. Antes de conectar o Galaxy, prepare o endereço HTTPS DEV alcançável na rede, com certificado válido. Não use `localhost` do tablet como endereço do computador. Nenhum VPS, túnel ou servidor de produção foi implantado nesta tarefa.

## Antes de uso operacional

Validar checklist e limites com a oficina, cadastrar dados reais pelo sistema, definir responsáveis e privilégios, preparar HTTPS/backup externo/restauração corporativa e distribuição assinada/MDM. O [guia de implantação](DEPLOYMENT.md) e [operações](OPERATIONS.md) tratam dessas etapas. Ordens de serviço, peças, estoque, custos, pneus como módulo e IA permanecem expansões futuras do prompt mestre.

A proteção automática de branch neste repositório privado depende de plano GitHub compatível; não está comprovada somente pela existência de PR/CI. Consulte [ADR005](../decisions/ADR-005-github-governance.md).